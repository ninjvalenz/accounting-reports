import sqlite3
import os
import json
from datetime import datetime

# Database path in the backend folder
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'sales_report.db')

def get_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn

def init_database():
    """Initialize database with schema"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # ========== FILE UPLOAD TRACKING ==========
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            uploaded_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            sheets_processed TEXT,
            months_years_processed TEXT,
            is_successful INTEGER DEFAULT 0,
            error_message TEXT
        )
    ''')
    
    # ========== LOOKUP TABLES ==========
    
    # Years table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS years (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER UNIQUE NOT NULL
        )
    ''')
    
    # Months table (pre-populated with 12 months)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS months (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            short_name TEXT NOT NULL,
            month_number INTEGER NOT NULL
        )
    ''')
    
    # Product categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS product_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    ''')
    
    # Products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            sub_category TEXT,
            name TEXT NOT NULL,
            type_of_sales TEXT,
            FOREIGN KEY (category_id) REFERENCES product_categories(id),
            UNIQUE(name, category_id)
        )
    ''')
    
    # ========== DATA TABLES ==========
    # Each upload has its own set of data (upload_id included in UNIQUE constraint)
    
    # Working days per month
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS working_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            year_id INTEGER NOT NULL,
            month_id INTEGER NOT NULL,
            days INTEGER NOT NULL,
            FOREIGN KEY (upload_id) REFERENCES file_uploads(id),
            FOREIGN KEY (year_id) REFERENCES years(id),
            FOREIGN KEY (month_id) REFERENCES months(id),
            UNIQUE(upload_id, year_id, month_id)
        )
    ''')
    
    # Budget projection (from Sales Projection 2025 sheet)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budget_projection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            year_id INTEGER NOT NULL,
            month_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity REAL DEFAULT 0,
            FOREIGN KEY (upload_id) REFERENCES file_uploads(id),
            FOREIGN KEY (year_id) REFERENCES years(id),
            FOREIGN KEY (month_id) REFERENCES months(id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            UNIQUE(upload_id, year_id, month_id, product_id)
        )
    ''')
    
    # Sales data (from Data sheet)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            year_id INTEGER NOT NULL,
            month_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            qty_budget REAL DEFAULT 0,
            amount_budget REAL DEFAULT 0,
            qty_actual REAL DEFAULT 0,
            amount_actual REAL DEFAULT 0,
            qty_liters_budget REAL DEFAULT 0,
            qty_liters_actual REAL DEFAULT 0,
            FOREIGN KEY (upload_id) REFERENCES file_uploads(id),
            FOREIGN KEY (year_id) REFERENCES years(id),
            FOREIGN KEY (month_id) REFERENCES months(id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            UNIQUE(upload_id, year_id, month_id, product_id)
        )
    ''')
    
    # Production data (from Production Data sheet)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS production_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            year_id INTEGER NOT NULL,
            month_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            qty_budget REAL DEFAULT 0,
            qty_budget_liters REAL DEFAULT 0,
            qty_actual REAL DEFAULT 0,
            qty_actual_liters REAL DEFAULT 0,
            FOREIGN KEY (upload_id) REFERENCES file_uploads(id),
            FOREIGN KEY (year_id) REFERENCES years(id),
            FOREIGN KEY (month_id) REFERENCES months(id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            UNIQUE(upload_id, year_id, month_id, product_id)
        )
    ''')
    
    # Sales by FPR (from SALES BY FPR sheet)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_by_fpr (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            year_id INTEGER NOT NULL,
            month_id INTEGER NOT NULL,
            salesman TEXT NOT NULL,
            location TEXT NOT NULL,
            type_of_sales TEXT,
            amount REAL DEFAULT 0,
            FOREIGN KEY (upload_id) REFERENCES file_uploads(id),
            FOREIGN KEY (year_id) REFERENCES years(id),
            FOREIGN KEY (month_id) REFERENCES months(id)
        )
    ''')
    
    # ========== PRE-POPULATE MONTHS ==========
    
    months_data = [
        ('January', 'Jan', 1),
        ('February', 'Feb', 2),
        ('March', 'Mar', 3),
        ('April', 'Apr', 4),
        ('May', 'May', 5),
        ('June', 'Jun', 6),
        ('July', 'Jul', 7),
        ('August', 'Aug', 8),
        ('September', 'Sep', 9),
        ('October', 'Oct', 10),
        ('November', 'Nov', 11),
        ('December', 'Dec', 12)
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO months (name, short_name, month_number)
        VALUES (?, ?, ?)
    ''', months_data)
    
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

def create_upload_record(filename):
    """Create a new upload record and return its ID"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO file_uploads (filename, uploaded_date, is_successful)
        VALUES (?, ?, 0)
    ''', (filename, datetime.now().isoformat()))
    upload_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return upload_id

def update_upload_success(upload_id, sheets_processed, months_years_processed):
    """Mark upload as successful and store metadata"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE file_uploads 
        SET is_successful = 1,
            sheets_processed = ?,
            months_years_processed = ?
        WHERE id = ?
    ''', (json.dumps(sheets_processed), json.dumps(months_years_processed), upload_id))
    conn.commit()
    conn.close()

def update_upload_error(upload_id, error_message):
    """Mark upload as failed and store error message"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE file_uploads 
        SET is_successful = 0,
            error_message = ?
        WHERE id = ?
    ''', (str(error_message), upload_id))
    conn.commit()
    conn.close()

def get_upload_history():
    """Get all upload records"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, filename, uploaded_date, sheets_processed, 
               months_years_processed, is_successful, error_message
        FROM file_uploads
        ORDER BY uploaded_date DESC
    ''')
    uploads = []
    for row in cursor.fetchall():
        uploads.append({
            'id': row['id'],
            'filename': row['filename'],
            'uploaded_date': row['uploaded_date'],
            'sheets_processed': json.loads(row['sheets_processed']) if row['sheets_processed'] else [],
            'months_years_processed': json.loads(row['months_years_processed']) if row['months_years_processed'] else [],
            'is_successful': bool(row['is_successful']),
            'error_message': row['error_message']
        })
    conn.close()
    return uploads

def reset_database():
    """Delete and recreate database"""
    if os.path.exists(DATABASE_PATH):
        os.remove(DATABASE_PATH)
        print(f"Deleted existing database: {DATABASE_PATH}")
    init_database()

if __name__ == '__main__':
    init_database()
