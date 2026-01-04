import pandas as pd
import re
from database.schema import get_connection, init_database, clear_data

# Month mapping: Excel format -> (Full name, month_number)
MONTH_MAP = {
    "Jan": ("January", 1),
    "Feb": ("February", 2),
    "Mar": ("March", 3),
    "Apr": ("April", 4),
    "May": ("May", 5),
    "Jun": ("June", 6),
    "Jul": ("July", 7),
    "Aug": ("August", 8),
    "Sep": ("September", 9),
    "Oct": ("October", 10),
    "Nov": ("November", 11),
    "Dec": ("December", 12)
}

def parse_month_year(month_str):
    """
    Parse month string like "Jan'25" or "Jul'25" to (month_name, year)
    Returns: ("January", 2025) or None if invalid
    """
    if not month_str or not isinstance(month_str, str):
        return None
    
    # Match patterns like "Jan'25", "Jul'25", "Jan'24"
    match = re.match(r"([A-Za-z]{3})'?(\d{2})", month_str)
    if match:
        month_abbr = match.group(1).capitalize()
        year_short = int(match.group(2))
        year_full = 2000 + year_short  # Convert 25 -> 2025
        
        if month_abbr in MONTH_MAP:
            month_name, month_num = MONTH_MAP[month_abbr]
            return (month_name, year_full)
    
    return None

def get_or_create_year(cursor, year):
    """Get year ID or create if not exists"""
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute('INSERT INTO years (year) VALUES (?)', (year,))
    return cursor.lastrowid

def get_month_id(cursor, month_name):
    """Get month ID by name"""
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def get_or_create_category(cursor, category_name):
    """Get category ID or create if not exists"""
    if not category_name or pd.isna(category_name):
        category_name = "Unknown"
    
    cursor.execute('SELECT id FROM product_categories WHERE name = ?', (category_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute('INSERT INTO product_categories (name) VALUES (?)', (category_name,))
    return cursor.lastrowid

def get_or_create_product(cursor, category_id, sub_category, product_name):
    """Get product ID or create if not exists"""
    if not product_name or pd.isna(product_name):
        product_name = "Unknown Product"
    
    sub_cat = sub_category if sub_category and not pd.isna(sub_category) else None
    
    cursor.execute('''
        SELECT id FROM products WHERE category_id = ? AND name = ?
    ''', (category_id, product_name))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute('''
        INSERT INTO products (category_id, sub_category, name) VALUES (?, ?, ?)
    ''', (category_id, sub_cat, product_name))
    return cursor.lastrowid


def import_working_days(cursor, filepath):
    """Import data from 'Day (in Month)' sheet"""
    print("Importing Working Days...")
    
    df = pd.read_excel(filepath, sheet_name='Day (in Month)')
    
    count = 0
    for _, row in df.iterrows():
        year = int(row['Year']) if pd.notna(row['Year']) else None
        month_str = row['Months'] if pd.notna(row['Months']) else None
        days = int(row['Days in months']) if pd.notna(row['Days in months']) else None
        
        if not year or not month_str or not days:
            continue
        
        parsed = parse_month_year(month_str)
        if not parsed:
            continue
        
        month_name, _ = parsed
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        
        if month_id:
            cursor.execute('''
                INSERT OR REPLACE INTO working_days (year_id, month_id, days)
                VALUES (?, ?, ?)
            ''', (year_id, month_id, days))
            count += 1
    
    print(f"  → Imported {count} working days records")


def import_budget_projection(cursor, filepath):
    """Import data from 'Sales Projection 2025' sheet"""
    print("Importing Budget Projection...")
    
    df = pd.read_excel(filepath, sheet_name='Sales Projection 2025', header=1)
    
    # Find month columns (like "Jan'25", "Feb'25", etc.)
    month_columns = []
    for col in df.columns:
        if isinstance(col, str) and re.match(r"[A-Za-z]{3}'?\d{2}$", col):
            parsed = parse_month_year(col)
            if parsed:
                month_columns.append((col, parsed[0], parsed[1]))  # (column_name, month_name, year)
    
    count = 0
    # Skip last row (it's the total row)
    for idx, row in df.iloc[:-1].iterrows():
        category = row.get('Product Category')
        sub_category = row.get('Product Category 2')
        product_name = row.get('Products')
        
        if pd.isna(product_name):
            continue
        
        category_id = get_or_create_category(cursor, category)
        product_id = get_or_create_product(cursor, category_id, sub_category, product_name)
        
        for col_name, month_name, year in month_columns:
            quantity = row.get(col_name)
            if pd.notna(quantity):
                year_id = get_or_create_year(cursor, year)
                month_id = get_month_id(cursor, month_name)
                
                if month_id:
                    cursor.execute('''
                        INSERT OR REPLACE INTO budget_projection (year_id, month_id, product_id, quantity)
                        VALUES (?, ?, ?, ?)
                    ''', (year_id, month_id, product_id, float(quantity)))
                    count += 1
    
    print(f"  → Imported {count} budget projection records")


def import_sales_data(cursor, filepath):
    """Import data from 'Data' sheet"""
    print("Importing Sales Data...")
    
    df = pd.read_excel(filepath, sheet_name='Data')
    
    count = 0
    for _, row in df.iterrows():
        year = int(row['Year']) if pd.notna(row['Year']) else None
        month_str = row['Month'] if pd.notna(row['Month']) else None
        
        if not year or not month_str:
            continue
        
        parsed = parse_month_year(month_str)
        if not parsed:
            continue
        
        month_name, _ = parsed
        
        category = row.get('Product Category')
        sub_category = row.get('Product Category 2')
        product_name = row.get('Products')
        
        if pd.isna(product_name):
            continue
        
        category_id = get_or_create_category(cursor, category)
        product_id = get_or_create_product(cursor, category_id, sub_category, product_name)
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        
        if month_id:
            cursor.execute('''
                INSERT INTO sales_data (
                    year_id, month_id, product_id, type_of_sales,
                    qty_budget, amount_budget, qty_liters_budget,
                    qty_actual, amount_actual, qty_liters_actual
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                year_id,
                month_id,
                product_id,
                row.get('Type of Sales') if pd.notna(row.get('Type of Sales')) else None,
                float(row.get('Qty-Budget', 0)) if pd.notna(row.get('Qty-Budget')) else 0,
                float(row.get('Amount-Budget (US$)', 0)) if pd.notna(row.get('Amount-Budget (US$)')) else 0,
                float(row.get('Qty in Liters (Budgeted)', 0)) if pd.notna(row.get('Qty in Liters (Budgeted)')) else 0,
                float(row.get('Qty-Actual', 0)) if pd.notna(row.get('Qty-Actual')) else 0,
                float(row.get('Amount-Actual (US$)', 0)) if pd.notna(row.get('Amount-Actual (US$)')) else 0,
                float(row.get('Qty in Liters', 0)) if pd.notna(row.get('Qty in Liters')) else 0
            ))
            count += 1
    
    print(f"  → Imported {count} sales data records")


def import_excel_to_database(filepath):
    """Main function to import all data from Excel to database"""
    print(f"\n{'='*50}")
    print("IMPORTING EXCEL TO DATABASE")
    print(f"{'='*50}")
    print(f"File: {filepath}\n")
    
    # Initialize database
    init_database()
    
    # Clear existing data
    clear_data()
    
    # Get connection
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Import each sheet
        import_working_days(cursor, filepath)
        import_budget_projection(cursor, filepath)
        import_sales_data(cursor, filepath)
        
        # Commit all changes
        conn.commit()
        print(f"\n{'='*50}")
        print("IMPORT COMPLETED SUCCESSFULLY!")
        print(f"{'='*50}\n")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {str(e)}")
        raise e
        
    finally:
        conn.close()


if __name__ == '__main__':
    # Test import
    import sys
    if len(sys.argv) > 1:
        import_excel_to_database(sys.argv[1])
    else:
        print("Usage: python excel_reader.py <path_to_excel_file>")
