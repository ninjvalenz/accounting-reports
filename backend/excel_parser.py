import pandas as pd
import gc
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

# Short month name mapping
SHORT_MONTH_MAP = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
}

def parse_month(month_str):
    """Convert Excel month format to (month_name, year)"""
    if month_str in MONTH_MAP:
        return MONTH_MAP[month_str]
    return None, None

def get_or_create_year(cursor, year):
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    result = cursor.fetchone()
    if result:
        return result[0]
    cursor.execute('INSERT INTO years (year) VALUES (?)', (year,))
    return cursor.lastrowid

def get_month_id(cursor, month_name):
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def get_or_create_category(cursor, category_name):
    if pd.isna(category_name) or not category_name:
        category_name = "Uncategorized"
    cursor.execute('SELECT id FROM product_categories WHERE name = ?', (category_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    cursor.execute('INSERT INTO product_categories (name) VALUES (?)', (category_name,))
    return cursor.lastrowid

def get_or_create_product(cursor, product_name, category_id, sub_category=None, type_of_sales=None):
    if pd.isna(product_name) or not product_name:
        return None
    cursor.execute('SELECT id FROM products WHERE name = ? AND category_id = ?', (product_name, category_id))
    result = cursor.fetchone()
    if result:
        return result[0]
    cursor.execute('INSERT INTO products (name, category_id, sub_category, type_of_sales) VALUES (?, ?, ?, ?)',
                   (product_name, category_id, sub_category, type_of_sales))
    return cursor.lastrowid

def safe_float(val):
    """Convert value to float, return 0 if NaN or invalid"""
    if pd.isna(val):
        return 0.0
    try:
        return float(val)
    except:
        return 0.0

def process_working_days(filepath, upload_id, months_years_set):
    print("📅 Processing Working Days...")
    df = pd.read_excel(filepath, sheet_name='Day (in Month)', engine='openpyxl')
    conn = get_connection()
    cursor = conn.cursor()
    count = 0
    
    for _, row in df.iterrows():
        month_name, year = parse_month(row['Months'])
        if not month_name:
            continue
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        if month_id:
            cursor.execute('INSERT OR REPLACE INTO working_days (upload_id, year_id, month_id, days) VALUES (?, ?, ?, ?)',
                           (upload_id, year_id, month_id, int(row['Days in months'])))
            count += 1
            months_years_set.add(f"{month_name} {year}")
    
    conn.commit()
    conn.close()
    del df
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_sales_projection(filepath, upload_id, months_years_set):
    print("📊 Processing Sales Projection...")
    df = pd.read_excel(filepath, sheet_name='Sales Projection 2025', header=1, engine='openpyxl')
    conn = get_connection()
    cursor = conn.cursor()
    
    month_columns = [col for col in df.columns if "'25" in str(col) and "." not in str(col)]
    count = 0
    
    for _, row in df.iterrows():
        product_name = row.get('Products')
        if pd.isna(product_name) or not product_name:
            continue
        
        category_id = get_or_create_category(cursor, row.get('Product Category'))
        product_id = get_or_create_product(cursor, product_name, category_id, 
                                           row.get('Product Category 2'), row.get('Type of Sales'))
        if not product_id:
            continue
        
        for month_col in month_columns:
            month_name, year = parse_month(month_col)
            if not month_name:
                continue
            year_id = get_or_create_year(cursor, year)
            month_id = get_month_id(cursor, month_name)
            if month_id:
                cursor.execute('INSERT OR REPLACE INTO budget_projection (upload_id, year_id, month_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)',
                               (upload_id, year_id, month_id, product_id, safe_float(row.get(month_col, 0))))
                count += 1
                months_years_set.add(f"{month_name} {year}")
    
    conn.commit()
    conn.close()
    del df
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_sales_data(filepath, upload_id, months_years_set):
    print("💰 Processing Sales Data...")
    df = pd.read_excel(filepath, sheet_name='Data', engine='openpyxl')
    conn = get_connection()
    cursor = conn.cursor()
    
    aggregated_data = {}
    
    for _, row in df.iterrows():
        month_name, year = parse_month(row.get('Month'))
        if not month_name:
            continue
        
        product_name = row.get('Products')
        if pd.isna(product_name) or not product_name:
            continue
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        category_id = get_or_create_category(cursor, row.get('Product Category'))
        product_id = get_or_create_product(cursor, product_name, category_id,
                                           row.get('Product Category 2'), row.get('Type of Sales'))
        
        if not month_id or not product_id:
            continue
        
        key = (year_id, month_id, product_id)
        if key not in aggregated_data:
            aggregated_data[key] = {'qb': 0, 'ab': 0, 'qa': 0, 'aa': 0, 'qlb': 0, 'qla': 0}
        
        aggregated_data[key]['qb'] += safe_float(row.get('Qty-Budget', 0))
        aggregated_data[key]['ab'] += safe_float(row.get('Amount-Budget (US$)', 0))
        aggregated_data[key]['qa'] += safe_float(row.get('Qty-Actual', 0))
        aggregated_data[key]['aa'] += safe_float(row.get('Amount-Actual (US$)', 0))
        aggregated_data[key]['qlb'] += safe_float(row.get('Qty in Liters (Budgeted)', 0))
        aggregated_data[key]['qla'] += safe_float(row.get('Qty in Liters', 0))
        months_years_set.add(f"{month_name} {year}")
    
    del df
    gc.collect()
    
    count = 0
    for (year_id, month_id, product_id), d in aggregated_data.items():
        cursor.execute('''INSERT INTO sales_data (upload_id, year_id, month_id, product_id, qty_budget, amount_budget, 
                          qty_actual, amount_actual, qty_liters_budget, qty_liters_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                       (upload_id, year_id, month_id, product_id, d['qb'], d['ab'], d['qa'], d['aa'], d['qlb'], d['qla']))
        count += 1
    
    conn.commit()
    conn.close()
    del aggregated_data
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_production_data(filepath, upload_id, months_years_set):
    print("🏭 Processing Production Data...")
    df = pd.read_excel(filepath, sheet_name='Production Data', engine='openpyxl')
    conn = get_connection()
    cursor = conn.cursor()
    
    aggregated_data = {}
    
    for _, row in df.iterrows():
        month_name, year = parse_month(row.get('Month'))
        if not month_name:
            continue
        
        product_name = row.get('Products')
        if pd.isna(product_name) or not product_name:
            continue
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        category_id = get_or_create_category(cursor, row.get('Product Category'))
        product_id = get_or_create_product(cursor, product_name, category_id,
                                           row.get('Product Category 2'), row.get('Type of Sales'))
        
        if not month_id or not product_id:
            continue
        
        key = (year_id, month_id, product_id)
        if key not in aggregated_data:
            aggregated_data[key] = {'qb': 0, 'qbl': 0, 'qa': 0, 'qal': 0}
        
        aggregated_data[key]['qb'] += safe_float(row.get('Qty-Budgeted', 0))
        aggregated_data[key]['qbl'] += safe_float(row.get('Qty Budgeted (In Ltrs)', 0))
        aggregated_data[key]['qa'] += safe_float(row.get('Qty-Actual', 0))
        aggregated_data[key]['qal'] += safe_float(row.get('Qty in Liters', 0))
        months_years_set.add(f"{month_name} {year}")
    
    del df
    gc.collect()
    
    count = 0
    for (year_id, month_id, product_id), d in aggregated_data.items():
        cursor.execute('''INSERT INTO production_data (upload_id, year_id, month_id, product_id, qty_budget, 
                          qty_budget_liters, qty_actual, qty_actual_liters) VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                       (upload_id, year_id, month_id, product_id, d['qb'], d['qbl'], d['qa'], d['qal']))
        count += 1
    
    conn.commit()
    conn.close()
    del aggregated_data
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_sales_by_fpr(filepath, upload_id, months_years_set):
    print("👥 Processing Sales by FPR...")
    df = pd.read_excel(filepath, sheet_name='SALES BY FPR', engine='openpyxl')
    conn = get_connection()
    cursor = conn.cursor()
    count = 0
    
    for _, row in df.iterrows():
        year = row.get('Year')
        month_short = row.get('Month')
        if pd.isna(year) or pd.isna(month_short):
            continue
        
        month_name = SHORT_MONTH_MAP.get(month_short)
        if not month_name:
            continue
        
        year_id = get_or_create_year(cursor, int(year))
        month_id = get_month_id(cursor, month_name)
        if not month_id:
            continue
        
        salesman = str(row.get('SalesMan', 'Unknown')).strip() if not pd.isna(row.get('SalesMan')) else 'Unknown'
        location = str(row.get('Location', 'Unknown')).strip() if not pd.isna(row.get('Location')) else 'Unknown'
        type_of_sales = str(row.get('Type of sales', 'Unknown')).strip() if not pd.isna(row.get('Type of sales')) else 'Unknown'
        
        cursor.execute('INSERT INTO sales_by_fpr (upload_id, year_id, month_id, salesman, location, type_of_sales, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
                       (upload_id, year_id, month_id, salesman, location, type_of_sales, safe_float(row.get('Amount', 0))))
        count += 1
        months_years_set.add(f"{month_name} {int(year)}")
    
    conn.commit()
    conn.close()
    del df
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_cost_data(filepath, upload_id, months_years_set):
    print("💰 Processing Cost Data...")
    from openpyxl import load_workbook
    
    wb = load_workbook(filepath, data_only=True, read_only=True)
    ws = wb['Dashboard-1']
    conn = get_connection()
    cursor = conn.cursor()
    count = 0
    
    for row in ws.iter_rows(min_row=110, max_row=120, max_col=3):
        month_cell = row[0].value
        if not month_cell or not isinstance(month_cell, str):
            continue
        
        month_name, year = parse_month(month_cell)
        if not month_name:
            continue
        
        year_id = get_or_create_year(cursor, year)
        month_id = get_month_id(cursor, month_name)
        if not month_id:
            continue
        
        fuel = safe_float(row[1].value)
        lec = safe_float(row[2].value)
        
        cursor.execute('INSERT OR REPLACE INTO cost_data (upload_id, year_id, month_id, fuel, lec) VALUES (?, ?, ?, ?, ?)',
                       (upload_id, year_id, month_id, fuel, lec))
        count += 1
        months_years_set.add(f"{month_name} {year}")
    
    conn.commit()
    conn.close()
    wb.close()
    gc.collect()
    print(f"   ✅ Saved {count} records")
    return count

def process_excel_file(filepath):
    """Main function to process entire Excel file"""
    import os
    filename = os.path.basename(filepath)
    print(f"\n{'='*50}")
    print(f"📁 Processing: {filename}")
    print(f"{'='*50}")
    
    upload_id = create_upload_record(filename)
    sheets_processed = []
    months_years_set = set()
    
    try:
        process_working_days(filepath, upload_id, months_years_set)
        sheets_processed.append("Day (in Month)")
        gc.collect()
        
        process_sales_projection(filepath, upload_id, months_years_set)
        sheets_processed.append("Sales Projection 2025")
        gc.collect()
        
        process_sales_data(filepath, upload_id, months_years_set)
        sheets_processed.append("Data")
        gc.collect()
        
        process_production_data(filepath, upload_id, months_years_set)
        sheets_processed.append("Production Data")
        gc.collect()
        
        process_sales_by_fpr(filepath, upload_id, months_years_set)
        sheets_processed.append("SALES BY FPR")
        gc.collect()
        
        process_cost_data(filepath, upload_id, months_years_set)
        sheets_processed.append("Dashboard-1")
        gc.collect()
        
        months_years_list = sorted(list(months_years_set), 
                                   key=lambda x: (int(x.split()[-1]), 
                                                  ["January", "February", "March", "April", "May", "June", 
                                                   "July", "August", "September", "October", "November", "December"].index(x.split()[0])))
        
        update_upload_success(upload_id, sheets_processed, months_years_list)
        print(f"\n✅ Complete! Sheets: {len(sheets_processed)}, Periods: {len(months_years_list)}")
        
        return {'success': True, 'upload_id': upload_id, 'sheets_processed': sheets_processed, 'months_years_processed': months_years_list}
        
    except Exception as e:
        update_upload_error(upload_id, str(e))
        print(f"\n❌ Error: {str(e)}")
        raise e
