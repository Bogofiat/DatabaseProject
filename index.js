const path = require('path');
const express = require('express');
const db =require('./dbtext'); // นำเข้าโมดูลฐานข้อมูล
const session = require('express-session');

const app = express();
app.set('view engine', 'ejs');
app.set('views',path.join(__dirname,'views'))
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: false })); //middleware สำหรับการแปลงข้อมูลที่ส่งมาจากฟอร์ม
app.use(express.json()); //middleware สำหรับการแปลงข้อมูล JSON ที่ส่งมาในคำขอ


app.use(session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: false,  // 
    cookie: {
        maxAge: 1000 * 60 * 60, // session อายุ 1 ชม.
    }
}));

app.use((req, res, next) => {
    res.locals.Customer_id = req.session.Customer_id || null; // ทำให้ตัวแปร customer_id สามารถเข้าถึงได้ในทุกมุมมอง (views)
    next();  // เรียกใช้ฟังก์ชันถัดไปในลำดับ middleware  middleware คือ ฟังก์ชันที่ทำงานระหว่างการรับคำขอ (request) และการส่งคำตอบ (response)
            // โดยการเรียกใช้ next() จะทำให้ Express รู้ว่าควรไปที่ middleware ถัดไปหรือไปยังตัวจัดการเส้นทาง (route handler) ถัดไป
});

app.get('/', (req, res) => {    // app สร้างตัวจัดการ เส้นทางสำหรับคำขอ GET ที่ราก ('/') 
// โดยมีฟังก์ชันที่รับพารามิเตอร์สองตัวคือ req (คำขอ) และ res (การตอบสนอง) ส่งไปยังมุมมอง 'จุดเริ่ม้ต้น'
  res.render('sign-in');         
});



app.post('/register', async (req, res) => { // ตัวจัดการเส้นทางสำหรับคำขอ POST ที่ '/register'
    try {
        const { first_name, last_name, sex, email, password } = req.body;

        const sql = ` 
            INSERT INTO customer (First_name, Last_name, Sex, Email, password, Create_date)
            VALUES (?, ?, ?, ?, ?, NOW())
        `; // SQL สำหรับการแทรกข้อมูลผู้ใช้ใหม่ลงในตาราง customer โดยใช้เครื่องหมายคำถาม (?) เป็นตัวแทนค่าที่จะถูกแทนที่ในภายหลัง

        await db.query(sql, [first_name, last_name, sex, email, password]); //

        return res.redirect('/');
    } catch (err) {
        console.error(err);
        return res.status(500).send("Error saving user");
    }
});


app.post('/login_gate', async (req,res) => {
    try {
        const {email, password} = req.body;

        const sql = `
            SELECT * FROM customer 
            WHERE Email = ? AND password = ?
        `;
        const [rows] = await db.query(sql, [email, password]);

        if(rows.length > 0){
           
            req.session.Customer_id = rows[0].Customer_id;
            console.log("✅ LOGIN | Session Saved:", req.session.Customer_id);
            return res.redirect('/home');
        }
        return res.status(401).send("Invalid email or password");

    } catch(err){
        console.error(err);
        return res.status(500).send("Error during login");
    }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/'); // กลับไปหน้า แรก โดย '/' ผมกำหนดให้มันเป็นหน้าแรก
  })
});



app.get('/home', async (req, res) => {
    try {
        const [products] = await db.query("SELECT * FROM product LIMIT 5");
        console.log("➡ AT HOME | Session:", req.session.Customer_id);
        res.render('home', { products });
    } catch (err) {
        console.error(err);
        return res.status(500).send("DB Error");
    }
});

//  แสดงรีวิวของสินค้านั้น ๆ
app.get('/review/:product_id', async (req, res) => {
    try {
        const product_id = req.params.product_id;

        const [products] = await db.query(
            `SELECT * FROM product WHERE product_id = ?`,
            [product_id]
        );

        if (products.length === 0) {
            return res.status(404).send("Product not found");
        }

        const [text_comments] = await db.query(
            `SELECT review_id, Customer_id,rating, comment, public_date
             FROM review
             WHERE product_id = ?
             ORDER BY public_date DESC`,
            [product_id]
        );

        res.render('review', {
            product: products[0],
            text_comments,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send("Error loading product review page");
    }
});


// บันทึกคอมเมนต์ลง DB
app.post('/review/:product_id', async (req, res) => {
    try {
        const product_id = req.params.product_id;
        const customer_id = req.session.Customer_id;
        const {comment,rating } = req.body;
        
        if (!customer_id) {
            return res.redirect('/'); // สมมติ พิเรน เข้ามาหน้าริวิวแต่ไม่ได้login พอกดsubmit ก็จะเด้งไปหน้าlogin 
        }

        const [exists] = await db.query(
            `SELECT review_id FROM review 
             WHERE Customer_id = ? AND product_id = ?`,
            [customer_id, product_id]
        );

        if (exists.length > 0) {
             return res.send(`
            <script>
                alert("คุณได้รีวิวสินค้านี้ไปแล้ว ไม่สามารถรีวิวซ้ำได้");
                window.location.href = "/review/${product_id}";
            </script> `);
            }

        await db.query(
            `INSERT INTO review (Customer_id, product_id,rating,comment, public_date)
             VALUES (?, ?, ?,?, NOW())`,
            [customer_id, product_id, rating,comment]
        );

        return res.redirect(`/review/${product_id}`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving review");
    }
});

// Edit Review 
app.get('/review/edit/:review_id', async (req, res) => {
    try {
        const review_id = req.params.review_id;
        const customer_id = req.session.Customer_id;

        const [review] = await db.query(
            `SELECT * FROM review WHERE review_id = ? AND Customer_id = ?`,
            [review_id, customer_id]
        );

        if (review.length === 0) return res.status(403).send("Unauthorized");

        res.render('edit-review', { review: review[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading review");
    }
});


// ✅ Update Review
app.post('/review/edit/:review_id', async (req, res) => {
    try {
        const review_id = req.params.review_id;
        const customer_id = req.session.Customer_id;
        const { comment, rating, product_id } = req.body;

        await db.query(
            `UPDATE review 
             SET comment = ?, rating = ?, public_date = NOW()
             WHERE review_id = ? AND Customer_id = ?`,
            [comment, rating, review_id, customer_id]
        );

        return res.redirect(`/review/${product_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating review");
    }
});

// ✅ Delete Review
app.post('/review/delete/:review_id', async (req, res) => {
    try {
        const review_id = req.params.review_id;
        const customer_id = req.session.Customer_id;

        // ✅ เช็คว่า รหัสลูกค้ากับ รีวิวมันถูกต้องกันไหม กันคนอื่นมากดมั่วๆ
        const [check] = await db.query(
            `SELECT product_id FROM review WHERE review_id = ? AND Customer_id = ?`,
            [review_id, customer_id]
        );

        if (check.length === 0)
            return res.status(403).send("Unauthorized");

            const product_id = check[0].product_id;

        // ✅ ลบจริง
        await db.query(
            `DELETE FROM review WHERE review_id = ? AND Customer_id = ?`,
            [review_id, customer_id]
        );

        // ✅ Redirect กลับหน้า review ของ product เดิม
        res.redirect(`/review/${product_id}`);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting review");
    }
});




app.use((req,res)=> {
    res.status(404).send("404 Not Found");
});

app.listen(3000,()=> {
    console.log("Server is running on port 3000");
});
