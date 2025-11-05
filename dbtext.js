require('dotenv').config();
const mysql =  require('mysql2')

const pool = mysql.createPool({
  host: process.env.DB_HOST,     // โฮสต์ MySQL
  user: process.env.DB_USER,     // ยูสเซอร์
  password: process.env.DB_PASS, // รหัสผ่าน
  database: process.env.DB_NAME, // ชื่อฐานข้อมูล
  port: Number(process.env.DB_PORT || 3306), // พอร์ต (ดีฟอลต์ 3306)
  waitForConnections: true,      // ถ้าเต็ม ให้ “รอคิว” แทนการโยน error ทันที
  connectionLimit: 10,           // เปิดคอนเนกชันพร้อมกันได้สูงสุด 10 เส้น
  queueLimit: 0,                 // จำกัดคิวกี่คำขอ (0 = ไม่จำกัด)
  charset: 'utf8mb4',            // รองรับไทย+อีโมจิ
  dateStrings: true,             // ให้วันที่/เวลาออกมาเป็นสตริง (เลี่ยง TimeZone ชวนงง)
});


module.exports = pool.promise(); // ใช้ promise-based API