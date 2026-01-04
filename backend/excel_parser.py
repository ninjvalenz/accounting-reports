import pandas as pd
from database import (
    get_connection, 
    create_upload_record, 
    update_upload_success, 
    update_upload_error
)

# Month mapping: Excel format -> (full_name, year)
MONTH_MAP = {
    "Jan'24": ("January", 2024),
    "Feb'24": ("February", 2024),
    "Mar'24": ("March", 2024),
    "Apr'24": ("April", 2024),
    "May'24": ("May", 2024),
    "Jun'24": ("June", 2024),
    "Jul'24": ("July", 2024),
    "Aug'24": ("August", 2024),
    "Sep'24": ("September", 2024),
    "Oct'24": ("October", 2024),
    "Nov'24": ("November", 2024),
    "Dec'24": ("December", 2024),
    "Jan'25": ("January", 2025),
    "Feb'25": ("February", 2025),
    "Mar'25": ("March", 2025),
    "Apr'25": ("April", 2025),
    "May'25": ("May", 2025),
    "Jun'25": ("June", 2025),
    "Jul'25": ("July", 2025),
    "Aug'25": ("August", 2025),
    "Sep'25": ("September", 2025),
    "Oct'25": ("October", 2025),
    "Nov'25": ("November", 2025),
    "Dec'25": ("December", 2025),
}

def parse_month(month_str):
    """Convert Excel month format to (month_name, year)"""
    if month_str in MONTH_MAP:
        return MONTH_MAP[month_str]
    return None, None

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
    if pd.isna(category_name) or not category_name:
        category_name = "Uncategorized"
    cursor.execute('SELECT id FROM product_categories WHERE name = ?', (category_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    cursor.execute('INSERT INTO product_categories (name) VALUES (?)', (category_name,))
    return cursor.lastrowid

def get_or_create_product(cursor, product_name, category_id, sub_category=None, type_of_sales=None):
    """Get product ID or create if not exists"""
    if pd.isna(product_name) or not product_name:
        return None
    
    cursor.execute('''
        SELECT id FROM products WHERE name = ? AND category_id = ?
    ''', (product_name, category_id))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute('''
        INSERT INTO products (name, category_id, sub_category, type_of_sales)
        VALUES (?, ?, ?, ?)
    ''', (product_name, category_id, sub_category, type_of_sales))
    return cursor.lastrowid

def process_working_days(filepath, upload_id, months_years_set):
    """Process 'Day (in Month)' sheet and save to database"""
    print("\n📅 Processing Working Days...")
    
    df = pd.read_excel(filepath, sheet_name='Day (in Month)')
    conn = get_connection()
    cursor = conn.cursor()
    
    count = 0
    for _, row in df.iterrows():
        month_str = row['Months']
        days = row['Days in months']
        
        month_name, year = parse_month(month_str)
        if not month_name:
            continue
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        
        if month_id:
            cursor.execute('''
                INSERT OR REPLACE INTO working_days (upload_id, year_id, month_id, days)
                VALUES (?, ?, ?, ?)
            ''', (upload_id, year_id, month_id, int(days)))
            count += 1
            months_years_set.add(f"{month_name} {year}")
    
    conn.commit()
    conn.close()
    print(f"   ✅ Saved {count} working days records")
    return count

def process_sales_projection(filepath, upload_id, months_years_set):
    """Process 'Sales Projection 2025' sheet and save to database"""
    print("\n📊 Processing Sales Projection...")
    
    df = pd.read_excel(filepath, sheet_name='Sales Projection 2025', header=1)
    conn = get_connection()
    cursor = conn.cursor()
    
    # Find month columns (Jan'25, Feb'25, etc.)
    month_columns = [col for col in df.columns if "'25" in str(col) and "." not in str(col)]
    
    count = 0
    for _, row in df.iterrows():
        # Get product info
        product_name = row.get('Products')
        category_name = row.get('Product Category')
        sub_category = row.get('Product Category 2')
        type_of_sales = row.get('Type of Sales')
        
        if pd.isna(product_name) or not product_name:
            continue
        
        # Get or create category and product
        category_id = get_or_create_category(cursor, category_name)
        product_id = get_or_create_product(cursor, product_name, category_id, sub_category, type_of_sales)
        
        if not product_id:
            continue
        
        # Process each month column
        for month_col in month_columns:
            month_name, year = parse_month(month_col)
            if not month_name:
                continue
            
            year_id = get_or_create_year(cursor, year)
            month_id = get_month_id(cursor, month_name)
            
            quantity = row.get(month_col, 0)
            if pd.isna(quantity):
                quantity = 0
            
            if month_id:
                cursor.execute('''
                    INSERT OR REPLACE INTO budget_projection (upload_id, year_id, month_id, product_id, quantity)
                    VALUES (?, ?, ?, ?, ?)
                ''', (upload_id, year_id, month_id, product_id, float(quantity)))
                count += 1
                months_years_set.add(f"{month_name} {year}")
    
    conn.commit()
    conn.close()
    print(f"   ✅ Saved {count} budget projection records")
    return count

def process_sales_data(filepath, upload_id, months_years_set):
    """Process 'Data' sheet and save to database"""
    print("\n💰 Processing Sales Data...")
    
    df = pd.read_excel(filepath, sheet_name='Data')
    conn = get_connection()
    cursor = conn.cursor()
    
    # Group data by year, month, product to aggregate within the same file
    aggregated_data = {}
    
    for _, row in df.iterrows():
        month_str = row.get('Month')
        month_name, year = parse_month(month_str)
        
        if not month_name:
            continue
        
        # Get product info
        product_name = row.get('Products')
        category_name = row.get('Product Category')
        sub_category = row.get('Product Category 2')
        type_of_sales = row.get('Type of Sales')
        
        if pd.isna(product_name) or not product_name:
            continue
        
        # Get or create entities
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        category_id = get_or_create_category(cursor, category_name)
        product_id = get_or_create_product(cursor, product_name, category_id, sub_category, type_of_sales)
        
        if not month_id or not product_id:
            continue
        
        # Get values (handle NaN)
        qty_budget = row.get('Qty-Budget', 0)
        amount_budget = row.get('Amount-Budget (US$)', 0)
        qty_actual = row.get('Qty-Actual', 0)
        amount_actual = row.get('Amount-Actual (US$)', 0)
        qty_liters_budget = row.get('Qty in Liters (Budgeted)', 0)
        qty_liters_actual = row.get('Qty in Liters', 0)
        
        # Replace NaN with 0
        qty_budget = 0 if pd.isna(qty_budget) else float(qty_budget)
        amount_budget = 0 if pd.isna(amount_budget) else float(amount_budget)
        qty_actual = 0 if pd.isna(qty_actual) else float(qty_actual)
        amount_actual = 0 if pd.isna(amount_actual) else float(amount_actual)
        qty_liters_budget = 0 if pd.isna(qty_liters_budget) else float(qty_liters_budget)
        qty_liters_actual = 0 if pd.isna(qty_liters_actual) else float(qty_liters_actual)
        
        # Create key for aggregation within same file
        key = (year_id, month_id, product_id)
        
        if key not in aggregated_data:
            aggregated_data[key] = {
                'qty_budget': 0,
                'amount_budget': 0,
                'qty_actual': 0,
                'amount_actual': 0,
                'qty_liters_budget': 0,
                'qty_liters_actual': 0
            }
        
        # Aggregate values within the same file
        aggregated_data[key]['qty_budget'] += qty_budget
        aggregated_data[key]['amount_budget'] += amount_budget
        aggregated_data[key]['qty_actual'] += qty_actual
        aggregated_data[key]['amount_actual'] += amount_actual
        aggregated_data[key]['qty_liters_budget'] += qty_liters_budget
        aggregated_data[key]['qty_liters_actual'] += qty_liters_actual
        
        months_years_set.add(f"{month_name} {year}")
    
    # Insert aggregated data
    count = 0
    for (year_id, month_id, product_id), data in aggregated_data.items():
        cursor.execute('''
            INSERT INTO sales_data 
            (upload_id, year_id, month_id, product_id, qty_budget, amount_budget, qty_actual, 
             amount_actual, qty_liters_budget, qty_liters_actual)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (upload_id, year_id, month_id, product_id, 
              data['qty_budget'], data['amount_budget'], data['qty_actual'],
              data['amount_actual'], data['qty_liters_budget'], data['qty_liters_actual']))
        count += 1
    
    conn.commit()
    conn.close()
    print(f"   ✅ Saved {count} sales data records")
    return count

def process_production_data(filepath, upload_id, months_years_set):
    """Process 'Production Data' sheet and save to database"""
    print("\n🏭 Processing Production Data...")
    
    df = pd.read_excel(filepath, sheet_name='Production Data')
    conn = get_connection()
    cursor = conn.cursor()
    
    # Group data by year, month, product to aggregate within the same file
    aggregated_data = {}
    
    for _, row in df.iterrows():
        month_str = row.get('Month')
        month_name, year = parse_month(month_str)
        
        if not month_name:
            continue
        
        # Get product info
        product_name = row.get('Products')
        category_name = row.get('Product Category')
        sub_category = row.get('Product Category 2')
        type_of_sales = row.get('Type of Sales')
        
        if pd.isna(product_name) or not product_name:
            continue
        
        # Get or create entities
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        category_id = get_or_create_category(cursor, category_name)
        product_id = get_or_create_product(cursor, product_name, category_id, sub_category, type_of_sales)
        
        if not month_id or not product_id:
            continue
        
        # Get values (handle NaN)
        qty_budget = row.get('Qty-Budgeted', 0)
        qty_budget_liters = row.get('Qty Budgeted (In Ltrs)', 0)
        qty_actual = row.get('Qty-Actual', 0)
        qty_actual_liters = row.get('Qty in Liters', 0)
        
        # Replace NaN with 0
        qty_budget = 0 if pd.isna(qty_budget) else float(qty_budget)
        qty_budget_liters = 0 if pd.isna(qty_budget_liters) else float(qty_budget_liters)
        qty_actual = 0 if pd.isna(qty_actual) else float(qty_actual)
        qty_actual_liters = 0 if pd.isna(qty_actual_liters) else float(qty_actual_liters)
        
        # Create key for aggregation within same file
        key = (year_id, month_id, product_id)
        
        if key not in aggregated_data:
            aggregated_data[key] = {
                'qty_budget': 0,
                'qty_budget_liters': 0,
                'qty_actual': 0,
                'qty_actual_liters': 0
            }
        
        # Aggregate values within the same file
        aggregated_data[key]['qty_budget'] += qty_budget
        aggregated_data[key]['qty_budget_liters'] += qty_budget_liters
        aggregated_data[key]['qty_actual'] += qty_actual
        aggregated_data[key]['qty_actual_liters'] += qty_actual_liters
        
        months_years_set.add(f"{month_name} {year}")
    
    # Insert aggregated data
    count = 0
    for (year_id, month_id, product_id), data in aggregated_data.items():
        cursor.execute('''
            INSERT INTO production_data 
            (upload_id, year_id, month_id, product_id, qty_budget, qty_budget_liters, 
             qty_actual, qty_actual_liters)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (upload_id, year_id, month_id, product_id, 
              data['qty_budget'], data['qty_budget_liters'],
              data['qty_actual'], data['qty_actual_liters']))
        count += 1
    
    conn.commit()
    conn.close()
    print(f"   ✅ Saved {count} production data records")
    return count

def process_excel_file(filepath):
    """Main function to process entire Excel file"""
    import os
    filename = os.path.basename(filepath)
    
    print(f"\n{'='*50}")
    print(f"📁 Processing Excel File: {filename}")
    print(f"{'='*50}")
    
    # Create upload record
    upload_id = create_upload_record(filename)
    
    # Track processed data
    sheets_processed = []
    months_years_set = set()
    
    try:
        # Process all required sheets
        process_working_days(filepath, upload_id, months_years_set)
        sheets_processed.append("Day (in Month)")
        
        process_sales_projection(filepath, upload_id, months_years_set)
        sheets_processed.append("Sales Projection 2025")
        
        process_sales_data(filepath, upload_id, months_years_set)
        sheets_processed.append("Data")
        
        process_production_data(filepath, upload_id, months_years_set)
        sheets_processed.append("Production Data")
        
        # Sort months_years for consistent display
        months_years_list = sorted(list(months_years_set), 
                                   key=lambda x: (int(x.split()[-1]), 
                                                  ["January", "February", "March", "April", 
                                                   "May", "June", "July", "August", 
                                                   "September", "October", "November", "December"].index(x.split()[0])))
        
        # Update upload record as successful
        update_upload_success(upload_id, sheets_processed, months_years_list)
        
        print(f"\n{'='*50}")
        print("✅ All data processed and saved to database!")
        print(f"📋 Sheets processed: {', '.join(sheets_processed)}")
        print(f"📅 Months/Years: {len(months_years_list)} periods")
        print(f"{'='*50}\n")
        
        return {
            'success': True,
            'upload_id': upload_id,
            'sheets_processed': sheets_processed,
            'months_years_processed': months_years_list
        }
        
    except Exception as e:
        # Update upload record with error
        update_upload_error(upload_id, str(e))
        print(f"\n❌ Error processing file: {str(e)}")
        raise e

if __name__ == '__main__':
    # Test with sample file
    import sys
    if len(sys.argv) > 1:
        process_excel_file(sys.argv[1])
    else:
        print("Usage: python excel_parser.py <path_to_excel_file>")
