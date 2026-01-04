"""
Test script to verify database contents
"""
from database import get_connection, init_database, reset_database, get_upload_history
from excel_parser import process_excel_file

def show_database_summary():
    """Display summary of all tables"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("\n" + "="*60)
    print("📊 DATABASE SUMMARY")
    print("="*60)
    
    # Count records in each table
    tables = ['file_uploads', 'years', 'months', 'product_categories', 'products', 
              'working_days', 'budget_projection', 'sales_data']
    
    for table in tables:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        print(f"  {table}: {count} records")
    
    conn.close()

def show_upload_history():
    """Show upload history"""
    uploads = get_upload_history()
    
    print("\n" + "="*60)
    print("📁 UPLOAD HISTORY")
    print("="*60)
    
    if not uploads:
        print("  No uploads yet")
        return
    
    for upload in uploads:
        status = "✅ Success" if upload['is_successful'] else "❌ Failed"
        print(f"\n  ID: {upload['id']}")
        print(f"  File: {upload['filename']}")
        print(f"  Date: {upload['uploaded_date']}")
        print(f"  Status: {status}")
        if upload['sheets_processed']:
            print(f"  Sheets: {', '.join(upload['sheets_processed'])}")
        if upload['months_years_processed']:
            print(f"  Periods: {len(upload['months_years_processed'])} months/years")
        if upload['error_message']:
            print(f"  Error: {upload['error_message']}")

def show_years():
    """Show all years"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM years')
    print("\n📅 YEARS:")
    for row in cursor.fetchall():
        print(f"   ID: {row['id']}, Year: {row['year']}")
    conn.close()

def show_months():
    """Show all months"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM months ORDER BY month_number')
    print("\n📆 MONTHS:")
    for row in cursor.fetchall():
        print(f"   {row['month_number']:2}. {row['name']} ({row['short_name']})")
    conn.close()

def show_categories():
    """Show all product categories"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM product_categories')
    print("\n📦 PRODUCT CATEGORIES:")
    for row in cursor.fetchall():
        print(f"   ID: {row['id']}, Name: {row['name']}")
    conn.close()

def show_working_days():
    """Show working days per month"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT y.year, m.name, w.days
        FROM working_days w
        JOIN years y ON w.year_id = y.id
        JOIN months m ON w.month_id = m.id
        ORDER BY y.year, m.month_number
    ''')
    print("\n📅 WORKING DAYS:")
    for row in cursor.fetchall():
        print(f"   {row['year']} {row['name']}: {row['days']} days")
    conn.close()

def show_sales_comparison(year, month_name):
    """Show Sales Comparison data for a specific month (like the dashboard)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print(f"\n{'='*60}")
    print(f"📊 COMPARISON - SALES (Budget vs Actual)")
    print(f"   Month: {month_name} {year}")
    print(f"{'='*60}")
    
    # Get year_id and month_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        print(f"   ❌ Year {year} not found")
        conn.close()
        return
    year_id = year_row['id']
    
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    month_row = cursor.fetchone()
    if not month_row:
        print(f"   ❌ Month {month_name} not found")
        conn.close()
        return
    month_id = month_row['id']
    
    # Get working days
    cursor.execute('''
        SELECT days FROM working_days 
        WHERE year_id = ? AND month_id = ?
    ''', (year_id, month_id))
    days_row = cursor.fetchone()
    working_days = days_row['days'] if days_row else 27
    
    # Get Budget Cases (from budget_projection)
    cursor.execute('''
        SELECT SUM(quantity) as total
        FROM budget_projection
        WHERE year_id = ? AND month_id = ?
    ''', (year_id, month_id))
    budget_cases = cursor.fetchone()['total'] or 0
    
    # Get Actual Cases (from sales_data)
    cursor.execute('''
        SELECT SUM(qty_actual) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ?
    ''', (year_id, month_id))
    actual_cases = cursor.fetchone()['total'] or 0
    
    # Get Budget Amount (from sales_data)
    cursor.execute('''
        SELECT SUM(amount_budget) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ?
    ''', (year_id, month_id))
    budget_amount = cursor.fetchone()['total'] or 0
    
    # Get Actual Amount (from sales_data)
    cursor.execute('''
        SELECT SUM(amount_actual) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ?
    ''', (year_id, month_id))
    actual_amount = cursor.fetchone()['total'] or 0
    
    # Calculate derived values
    variance_cases = actual_cases - budget_cases
    variance_amount = actual_amount - budget_amount
    daily_avg_budget = budget_cases / working_days if working_days > 0 else 0
    daily_avg_actual = actual_cases / working_days if working_days > 0 else 0
    daily_avg_variance = daily_avg_actual - daily_avg_budget
    
    # Print results
    print(f"\n   Working Days: {working_days}")
    print(f"\n   {'METRIC':<30} {'BUDGET':>15} {'ACTUAL':>15} {'VARIANCE':>15}")
    print(f"   {'-'*75}")
    print(f"   {'Sales Cases':<30} {budget_cases:>15,.2f} {actual_cases:>15,.2f} {variance_cases:>15,.2f}")
    print(f"   {'Daily Case Avg':<30} {daily_avg_budget:>15,.2f} {daily_avg_actual:>15,.2f} {daily_avg_variance:>15,.2f}")
    print(f"   {'Sales Amount (US$)':<30} {budget_amount:>15,.2f} {actual_amount:>15,.2f} {variance_amount:>15,.2f}")
    
    conn.close()

def run_full_test(excel_path):
    """Run complete test"""
    # Reset and initialize database
    print("\n🔄 Resetting database...")
    reset_database()
    
    # Process Excel file
    process_excel_file(excel_path)
    
    # Show summary
    show_database_summary()
    show_upload_history()
    show_years()
    show_categories()
    show_working_days()
    
    # Show comparison for a few months
    show_sales_comparison(2025, "January")
    show_sales_comparison(2025, "July")
    show_sales_comparison(2025, "December")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        run_full_test(sys.argv[1])
    else:
        print("Usage: python test_database.py <path_to_excel_file>")
        print("\nExample:")
        print("  python test_database.py uploads/Sales_Perfomance_2025.xlsx")
