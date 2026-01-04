import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from database import init_database, get_connection, get_upload_history
from excel_parser import process_excel_file

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize database on startup
init_database()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_latest_upload_id():
    """Get the ID of the latest successful upload"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id FROM file_uploads 
        WHERE is_successful = 1 
        ORDER BY uploaded_date DESC 
        LIMIT 1
    ''')
    row = cursor.fetchone()
    conn.close()
    return row['id'] if row else None

def get_available_months():
    """Get list of available months from database (latest upload only)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return []
    
    cursor.execute('''
        SELECT DISTINCT y.year, m.name, m.month_number
        FROM sales_data sd
        JOIN years y ON sd.year_id = y.id
        JOIN months m ON sd.month_id = m.id
        WHERE sd.upload_id = ?
        ORDER BY y.year DESC, m.month_number DESC
    ''', (latest_upload_id,))
    
    months = []
    for row in cursor.fetchall():
        months.append({
            'year': row['year'],
            'month': row['name'],
            'display': f"{row['name']} {row['year']}"
        })
    
    conn.close()
    return months

def get_available_years():
    """Get list of available years from database (latest upload only)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return []
    
    cursor.execute('''
        SELECT DISTINCT y.year 
        FROM sales_data sd
        JOIN years y ON sd.year_id = y.id
        WHERE sd.upload_id = ?
        ORDER BY y.year DESC
    ''', (latest_upload_id,))
    
    years = [row['year'] for row in cursor.fetchall()]
    conn.close()
    return years

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload and process Excel file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Process Excel and save to database
            result = process_excel_file(filepath)
            
            # Get available months for the frontend
            months = get_available_months()
            years = get_available_years()
            
            return jsonify({
                'success': True,
                'message': 'File uploaded and processed successfully',
                'upload_id': result['upload_id'],
                'sheets_processed': result['sheets_processed'],
                'months_years_processed': result['months_years_processed'],
                'available_months': months,
                'available_years': years
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/uploads', methods=['GET'])
def get_uploads():
    """Get upload history"""
    uploads = get_upload_history()
    return jsonify({'uploads': uploads})

@app.route('/api/uploads/<int:upload_id>', methods=['DELETE'])
def delete_upload(upload_id):
    """Delete an upload and its associated data"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if upload exists
        cursor.execute('SELECT id FROM file_uploads WHERE id = ?', (upload_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Upload not found'}), 404
        
        # Delete associated data
        cursor.execute('DELETE FROM sales_data WHERE upload_id = ?', (upload_id,))
        cursor.execute('DELETE FROM budget_projection WHERE upload_id = ?', (upload_id,))
        cursor.execute('DELETE FROM working_days WHERE upload_id = ?', (upload_id,))
        cursor.execute('DELETE FROM production_data WHERE upload_id = ?', (upload_id,))
        cursor.execute('DELETE FROM sales_by_fpr WHERE upload_id = ?', (upload_id,))
        cursor.execute('DELETE FROM cost_data WHERE upload_id = ?', (upload_id,))
        
        # Delete the upload record
        cursor.execute('DELETE FROM file_uploads WHERE id = ?', (upload_id,))
        
        # Clean up orphaned products (not referenced by any sales_data, budget_projection, or production_data)
        cursor.execute('''
            DELETE FROM products WHERE id NOT IN (
                SELECT DISTINCT product_id FROM sales_data
                UNION
                SELECT DISTINCT product_id FROM budget_projection
                UNION
                SELECT DISTINCT product_id FROM production_data
            )
        ''')
        
        # Clean up orphaned product categories (not referenced by any products)
        cursor.execute('''
            DELETE FROM product_categories WHERE id NOT IN (
                SELECT DISTINCT category_id FROM products
            )
        ''')
        
        # Clean up orphaned years (not referenced by any data)
        cursor.execute('''
            DELETE FROM years WHERE id NOT IN (
                SELECT DISTINCT year_id FROM sales_data
                UNION
                SELECT DISTINCT year_id FROM budget_projection
                UNION
                SELECT DISTINCT year_id FROM working_days
                UNION
                SELECT DISTINCT year_id FROM production_data
            )
        ''')
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': f'Upload {upload_id} and all related data deleted successfully'})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/months', methods=['GET'])
def get_months():
    """Get available months"""
    months = get_available_months()
    return jsonify({'months': months})

@app.route('/api/years', methods=['GET'])
def get_years():
    """Get available years"""
    years = get_available_years()
    return jsonify({'years': years})

@app.route('/api/comparison-sales', methods=['GET'])
def get_comparison_sales():
    """Get Comparison - Sales (Budget vs Actual) data from latest upload"""
    year = request.args.get('year', 2025, type=int)
    month_name = request.args.get('month', 'July')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get month_id
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    month_row = cursor.fetchone()
    if not month_row:
        conn.close()
        return jsonify({'error': f'Month {month_name} not found'}), 404
    month_id = month_row['id']
    
    # Get working days (from latest upload)
    cursor.execute('''
        SELECT days FROM working_days 
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    days_row = cursor.fetchone()
    working_days = days_row['days'] if days_row else 27
    
    # Get Budget Cases (from budget_projection, latest upload)
    cursor.execute('''
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM budget_projection
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    budget_cases = cursor.fetchone()['total']
    
    # Get Actual Cases (from sales_data, latest upload)
    cursor.execute('''
        SELECT COALESCE(SUM(qty_actual), 0) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    actual_cases = cursor.fetchone()['total']
    
    # Get Budget Amount (from sales_data, latest upload)
    cursor.execute('''
        SELECT COALESCE(SUM(amount_budget), 0) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    budget_amount = cursor.fetchone()['total']
    
    # Get Actual Amount (from sales_data, latest upload)
    cursor.execute('''
        SELECT COALESCE(SUM(amount_actual), 0) as total
        FROM sales_data
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    actual_amount = cursor.fetchone()['total']
    
    conn.close()
    
    # Calculate derived values
    variance_cases = actual_cases - budget_cases
    variance_amount = actual_amount - budget_amount
    daily_avg_budget = budget_cases / working_days if working_days > 0 else 0
    daily_avg_actual = actual_cases / working_days if working_days > 0 else 0
    daily_avg_variance = daily_avg_actual - daily_avg_budget
    
    # Collection (hardcoded for now - can be made dynamic later)
    collection = 583286.95
    collection_efficiency = (collection / actual_amount * 100) if actual_amount > 0 else 0
    
    return jsonify({
        'year': year,
        'month': month_name,
        'days_in_month': working_days,
        'upload_id': latest_upload_id,
        'metrics': [
            {
                'name': 'Sales Cases',
                'budget': round(budget_cases, 2),
                'actual': round(actual_cases, 2),
                'variance': round(variance_cases, 2)
            },
            {
                'name': 'Daily Case Avg',
                'budget': round(daily_avg_budget, 2),
                'actual': round(daily_avg_actual, 2),
                'variance': round(daily_avg_variance, 2)
            },
            {
                'name': 'Sales Amount (US$)',
                'budget': round(budget_amount, 2),
                'actual': round(actual_amount, 2),
                'variance': round(variance_amount, 2)
            },
            {
                'name': 'Collection (US$)',
                'budget': None,
                'actual': round(collection, 2),
                'variance': None
            },
            {
                'name': 'Collection Efficiency Ratio (% of Sales)',
                'budget': None,
                'actual': round(collection_efficiency, 2),
                'variance': None
            }
        ]
    })

@app.route('/api/comparison-production', methods=['GET'])
def get_comparison_production():
    """Get Comparison - Production (Budget vs Actual) data from latest upload
    
    Budget comes from: SUM of budget_projection (Sales Projection 2025 sheet)
    Actual comes from: SUM of production_data.qty_actual (Production Data sheet)
    """
    year = request.args.get('year', 2025, type=int)
    month_name = request.args.get('month', 'July')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get month_id
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    month_row = cursor.fetchone()
    if not month_row:
        conn.close()
        return jsonify({'error': f'Month {month_name} not found'}), 404
    month_id = month_row['id']
    
    # Get working days (from latest upload)
    cursor.execute('''
        SELECT days FROM working_days 
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    days_row = cursor.fetchone()
    working_days = days_row['days'] if days_row else 27
    
    # Get Budget Cases from budget_projection (Sales Projection 2025 sheet)
    cursor.execute('''
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM budget_projection
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    budget_cases = cursor.fetchone()['total']
    
    # Get Actual Cases from production_data (Production Data sheet, Column K)
    cursor.execute('''
        SELECT COALESCE(SUM(qty_actual), 0) as total
        FROM production_data
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    actual_cases = cursor.fetchone()['total']
    
    # Get Actual Liters from production_data
    cursor.execute('''
        SELECT COALESCE(SUM(qty_actual_liters), 0) as total
        FROM production_data
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
    ''', (year_id, month_id, latest_upload_id))
    actual_liters = cursor.fetchone()['total']
    
    conn.close()
    
    # Calculate derived values
    variance_cases = actual_cases - budget_cases
    daily_avg_budget = budget_cases / working_days if working_days > 0 else 0
    daily_avg_actual = actual_cases / working_days if working_days > 0 else 0
    daily_avg_variance = daily_avg_actual - daily_avg_budget
    daily_liter_avg = actual_liters / working_days if working_days > 0 else 0
    
    return jsonify({
        'year': year,
        'month': month_name,
        'days_in_month': working_days,
        'upload_id': latest_upload_id,
        'metrics': [
            {
                'name': 'Production Cases',
                'budget': round(budget_cases, 2),
                'actual': round(actual_cases, 2),
                'variance': round(variance_cases, 2)
            },
            {
                'name': 'Daily Case Avg',
                'budget': round(daily_avg_budget, 2),
                'actual': round(daily_avg_actual, 2),
                'variance': round(daily_avg_variance, 2)
            },
            {
                'name': 'Production in Liters',
                'budget': None,
                'actual': round(actual_liters, 2),
                'variance': None
            },
            {
                'name': 'Daily Liter Avg',
                'budget': None,
                'actual': round(daily_liter_avg, 2),
                'variance': None
            }
        ]
    })

@app.route('/api/sales-category-wise', methods=['GET'])
def get_sales_category_wise():
    """Get Sales Category Wise data from latest upload
    
    Groups sales data by Product Category for selected month(s).
    Supports multiple months and years via comma-separated values.
    """
    years_param = request.args.get('years', '2025')  # comma-separated years
    months_param = request.args.get('months', 'July')  # comma-separated months
    
    # Parse comma-separated values
    years = [int(y.strip()) for y in years_param.split(',') if y.strip()]
    months = [m.strip() for m in months_param.split(',') if m.strip()]
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_ids
    year_ids = []
    for year in years:
        cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
        year_row = cursor.fetchone()
        if year_row:
            year_ids.append(year_row['id'])
    
    if not year_ids:
        conn.close()
        return jsonify({'error': 'No valid years found'}), 404
    
    # Get month_ids
    month_ids = []
    for month_name in months:
        cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
        month_row = cursor.fetchone()
        if month_row:
            month_ids.append(month_row['id'])
    
    if not month_ids:
        conn.close()
        return jsonify({'error': 'No valid months found'}), 404
    
    # Build dynamic query with placeholders
    year_placeholders = ','.join(['?' for _ in year_ids])
    month_placeholders = ','.join(['?' for _ in month_ids])
    
    query = f'''
        SELECT 
            pc.name as category,
            COALESCE(SUM(sd.qty_actual), 0) as qty_cases,
            COALESCE(SUM(sd.qty_liters_actual), 0) as qty_liters,
            COALESCE(SUM(sd.amount_actual), 0) as amount_usd
        FROM sales_data sd
        JOIN products p ON sd.product_id = p.id
        JOIN product_categories pc ON p.category_id = pc.id
        WHERE sd.year_id IN ({year_placeholders}) 
          AND sd.month_id IN ({month_placeholders}) 
          AND sd.upload_id = ?
        GROUP BY pc.id, pc.name
        ORDER BY qty_cases DESC
    '''
    
    params = year_ids + month_ids + [latest_upload_id]
    cursor.execute(query, params)
    
    categories = []
    total_cases = 0
    total_liters = 0
    total_amount = 0
    
    for row in cursor.fetchall():
        qty_cases = row['qty_cases']
        qty_liters = row['qty_liters']
        amount_usd = row['amount_usd']
        
        # Skip categories with no data
        if qty_cases == 0 and qty_liters == 0 and amount_usd == 0:
            continue
            
        categories.append({
            'category': row['category'],
            'qty_cases': round(qty_cases, 2),
            'qty_liters': round(qty_liters, 2),
            'amount_usd': round(amount_usd, 2)
        })
        
        total_cases += qty_cases
        total_liters += qty_liters
        total_amount += amount_usd
    
    conn.close()
    
    return jsonify({
        'years': years,
        'months': months,
        'upload_id': latest_upload_id,
        'categories': categories,
        'totals': {
            'qty_cases': round(total_cases, 2),
            'qty_liters': round(total_liters, 2),
            'amount_usd': round(total_amount, 2)
        }
    })

@app.route('/api/production-category-wise', methods=['GET'])
def get_production_category_wise():
    """Get Production Category Wise data from latest upload
    
    Groups production data by Product Category for selected month(s) and year(s).
    Supports multiple selections via comma-separated values.
    """
    years_param = request.args.get('years', '2025')  # comma-separated years
    months_param = request.args.get('months', 'July')  # comma-separated months
    
    # Parse comma-separated values
    years = [int(y.strip()) for y in years_param.split(',') if y.strip()]
    month_names = [m.strip() for m in months_param.split(',') if m.strip()]
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_ids
    year_ids = []
    for year in years:
        cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
        year_row = cursor.fetchone()
        if year_row:
            year_ids.append(year_row['id'])
    
    if not year_ids:
        conn.close()
        return jsonify({'error': 'No valid years found'}), 404
    
    # Get month_ids
    month_ids = []
    for month_name in month_names:
        cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
        month_row = cursor.fetchone()
        if month_row:
            month_ids.append(month_row['id'])
    
    if not month_ids:
        conn.close()
        return jsonify({'error': 'No valid months found'}), 404
    
    # Build placeholders for IN clause
    year_placeholders = ','.join(['?' for _ in year_ids])
    month_placeholders = ','.join(['?' for _ in month_ids])
    
    # Get production data grouped by category
    query = f'''
        SELECT 
            pc.name as category,
            COALESCE(SUM(pd.qty_actual), 0) as qty_cases,
            COALESCE(SUM(pd.qty_actual_liters), 0) as qty_liters
        FROM production_data pd
        JOIN products p ON pd.product_id = p.id
        JOIN product_categories pc ON p.category_id = pc.id
        WHERE pd.year_id IN ({year_placeholders}) 
          AND pd.month_id IN ({month_placeholders}) 
          AND pd.upload_id = ?
        GROUP BY pc.id, pc.name
        ORDER BY qty_cases DESC
    '''
    
    params = year_ids + month_ids + [latest_upload_id]
    cursor.execute(query, params)
    
    categories = []
    total_cases = 0
    total_liters = 0
    
    for row in cursor.fetchall():
        qty_cases = row['qty_cases']
        qty_liters = row['qty_liters']
        
        # Skip categories with no data
        if qty_cases == 0 and qty_liters == 0:
            continue
            
        categories.append({
            'category': row['category'],
            'qty_cases': round(qty_cases, 2),
            'qty_liters': round(qty_liters, 2)
        })
        
        total_cases += qty_cases
        total_liters += qty_liters
    
    conn.close()
    
    return jsonify({
        'years': years,
        'months': month_names,
        'upload_id': latest_upload_id,
        'categories': categories,
        'totals': {
            'qty_cases': round(total_cases, 2),
            'qty_liters': round(total_liters, 2)
        }
    })

@app.route('/api/yoy-growth', methods=['GET'])
def get_yoy_growth():
    """Get YoY (Year over Year) Growth data from latest upload
    
    Shows Sum of Qty-Actual and Sum of Amount (US$) by Product Category,
    comparing years side by side for selected months.
    """
    months_param = request.args.get('months', 'July')  # comma-separated months
    
    # Parse comma-separated values
    month_names = [m.strip() for m in months_param.split(',') if m.strip()]
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get all available years
    cursor.execute('''
        SELECT DISTINCT y.id, y.year 
        FROM years y
        JOIN sales_data sd ON y.id = sd.year_id
        WHERE sd.upload_id = ?
        ORDER BY y.year
    ''', (latest_upload_id,))
    years_data = cursor.fetchall()
    years = [row['year'] for row in years_data]
    year_ids = [row['id'] for row in years_data]
    
    if not year_ids:
        conn.close()
        return jsonify({'error': 'No years found'}), 404
    
    # Get month_ids
    month_ids = []
    for month_name in month_names:
        cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
        month_row = cursor.fetchone()
        if month_row:
            month_ids.append(month_row['id'])
    
    if not month_ids:
        conn.close()
        return jsonify({'error': 'No valid months found'}), 404
    
    # Build placeholders
    month_placeholders = ','.join(['?' for _ in month_ids])
    
    # Get data grouped by category and year
    query = f'''
        SELECT 
            pc.name as category,
            y.year as year,
            COALESCE(SUM(sd.qty_actual), 0) as qty_actual,
            COALESCE(SUM(sd.amount_actual), 0) as amount_actual
        FROM sales_data sd
        JOIN products p ON sd.product_id = p.id
        JOIN product_categories pc ON p.category_id = pc.id
        JOIN years y ON sd.year_id = y.id
        WHERE sd.month_id IN ({month_placeholders}) 
          AND sd.upload_id = ?
        GROUP BY pc.id, pc.name, y.year
        ORDER BY pc.name, y.year
    '''
    
    params = month_ids + [latest_upload_id]
    cursor.execute(query, params)
    
    # Organize data by category
    category_data = {}
    year_totals_qty = {year: 0 for year in years}
    year_totals_amount = {year: 0 for year in years}
    
    for row in cursor.fetchall():
        category = row['category']
        year = row['year']
        qty = row['qty_actual']
        amount = row['amount_actual']
        
        if category not in category_data:
            category_data[category] = {
                'category': category,
                'qty_by_year': {y: 0 for y in years},
                'amount_by_year': {y: 0 for y in years}
            }
        
        category_data[category]['qty_by_year'][year] = qty
        category_data[category]['amount_by_year'][year] = amount
        year_totals_qty[year] += qty
        year_totals_amount[year] += amount
    
    conn.close()
    
    # Convert to list and calculate YoY growth percentages
    categories = []
    for cat_name, cat_data in sorted(category_data.items()):
        cat_entry = {
            'category': cat_name,
            'qty_by_year': {str(y): round(cat_data['qty_by_year'][y], 2) for y in years},
            'amount_by_year': {str(y): round(cat_data['amount_by_year'][y], 2) for y in years}
        }
        
        # Calculate YoY growth if we have 2+ years
        if len(years) >= 2:
            prev_year = years[-2]
            curr_year = years[-1]
            prev_qty = cat_data['qty_by_year'][prev_year]
            curr_qty = cat_data['qty_by_year'][curr_year]
            prev_amount = cat_data['amount_by_year'][prev_year]
            curr_amount = cat_data['amount_by_year'][curr_year]
            
            cat_entry['qty_growth_pct'] = round(((curr_qty - prev_qty) / prev_qty * 100), 2) if prev_qty > 0 else None
            cat_entry['amount_growth_pct'] = round(((curr_amount - prev_amount) / prev_amount * 100), 2) if prev_amount > 0 else None
        
        categories.append(cat_entry)
    
    # Calculate totals growth
    totals = {
        'qty_by_year': {str(y): round(year_totals_qty[y], 2) for y in years},
        'amount_by_year': {str(y): round(year_totals_amount[y], 2) for y in years}
    }
    
    if len(years) >= 2:
        prev_year = years[-2]
        curr_year = years[-1]
        totals['qty_growth_pct'] = round(((year_totals_qty[curr_year] - year_totals_qty[prev_year]) / year_totals_qty[prev_year] * 100), 2) if year_totals_qty[prev_year] > 0 else None
        totals['amount_growth_pct'] = round(((year_totals_amount[curr_year] - year_totals_amount[prev_year]) / year_totals_amount[prev_year] * 100), 2) if year_totals_amount[prev_year] > 0 else None
    
    return jsonify({
        'years': years,
        'months': month_names,
        'upload_id': latest_upload_id,
        'categories': categories,
        'totals': totals
    })

@app.route('/api/mom-growth', methods=['GET'])
def get_mom_growth():
    """Get MoM (Month over Month) Growth data from latest upload
    
    Shows monthly sales data with quantity by category, total qty, sales amount,
    and MoM growth percentage.
    """
    year = request.args.get('year', 2025, type=int)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get all categories
    cursor.execute('''
        SELECT DISTINCT pc.id, pc.name 
        FROM product_categories pc
        JOIN products p ON pc.id = p.category_id
        JOIN sales_data sd ON p.id = sd.product_id
        WHERE sd.upload_id = ? AND sd.year_id = ?
        ORDER BY pc.name
    ''', (latest_upload_id, year_id))
    categories = [{'id': row['id'], 'name': row['name']} for row in cursor.fetchall()]
    category_names = [c['name'] for c in categories]
    
    # Get monthly data grouped by month and category
    cursor.execute('''
        SELECT 
            m.month_number,
            m.name as month_name,
            pc.name as category,
            COALESCE(SUM(sd.qty_actual), 0) as qty_actual,
            COALESCE(SUM(sd.amount_actual), 0) as amount_actual
        FROM sales_data sd
        JOIN products p ON sd.product_id = p.id
        JOIN product_categories pc ON p.category_id = pc.id
        JOIN months m ON sd.month_id = m.id
        WHERE sd.year_id = ? AND sd.upload_id = ?
        GROUP BY m.month_number, m.name, pc.name
        ORDER BY m.month_number, pc.name
    ''', (year_id, latest_upload_id))
    
    # Organize data by month
    month_data = {}
    for row in cursor.fetchall():
        month_num = row['month_number']
        month_name = row['month_name']
        category = row['category']
        qty = row['qty_actual']
        amount = row['amount_actual']
        
        if month_num not in month_data:
            month_data[month_num] = {
                'month': month_name,
                'month_number': month_num,
                'qty_by_category': {c: 0 for c in category_names},
                'total_qty': 0,
                'sales_amount': 0
            }
        
        month_data[month_num]['qty_by_category'][category] = qty
        month_data[month_num]['total_qty'] += qty
        month_data[month_num]['sales_amount'] += amount
    
    conn.close()
    
    # Convert to sorted list and calculate MoM growth
    months_list = []
    prev_amount = None
    
    for month_num in sorted(month_data.keys()):
        m = month_data[month_num]
        entry = {
            'month': m['month'],
            'month_short': m['month'][:3] + "'" + str(year)[2:],
            'qty_by_category': {k: round(v, 2) for k, v in m['qty_by_category'].items()},
            'total_qty': round(m['total_qty'], 2),
            'sales_amount': round(m['sales_amount'], 2),
            'mom_growth_pct': None
        }
        
        # Calculate MoM growth
        if prev_amount is not None and prev_amount > 0:
            growth = ((m['sales_amount'] - prev_amount) / prev_amount) * 100
            entry['mom_growth_pct'] = round(growth, 2)
        
        prev_amount = m['sales_amount']
        months_list.append(entry)
    
    return jsonify({
        'year': year,
        'upload_id': latest_upload_id,
        'categories': category_names,
        'months': months_list
    })

@app.route('/api/sales-by-location-salesman', methods=['GET'])
def get_sales_by_location_salesman():
    """Get Sales by Location and Sales by Salesman data from latest upload"""
    year = request.args.get('year', 2025, type=int)
    month_name = request.args.get('month', 'July')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get month_id
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    month_row = cursor.fetchone()
    if not month_row:
        conn.close()
        return jsonify({'error': f'Month {month_name} not found'}), 404
    month_id = month_row['id']
    
    # Get Sales by Salesman
    cursor.execute('''
        SELECT 
            salesman,
            SUM(amount) as total_amount
        FROM sales_by_fpr
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
        GROUP BY salesman
        ORDER BY total_amount DESC
    ''', (year_id, month_id, latest_upload_id))
    
    by_salesman = []
    salesman_total = 0
    for row in cursor.fetchall():
        amount = row['total_amount']
        by_salesman.append({
            'name': row['salesman'],
            'amount': round(amount, 2)
        })
        salesman_total += amount
    
    # Get Sales by Location
    cursor.execute('''
        SELECT 
            location,
            SUM(amount) as total_amount
        FROM sales_by_fpr
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
        GROUP BY location
        ORDER BY total_amount DESC
    ''', (year_id, month_id, latest_upload_id))
    
    by_location = []
    location_total = 0
    for row in cursor.fetchall():
        amount = row['total_amount']
        by_location.append({
            'name': row['location'],
            'amount': round(amount, 2)
        })
        location_total += amount
    
    conn.close()
    
    return jsonify({
        'year': year,
        'month': month_name,
        'upload_id': latest_upload_id,
        'by_salesman': {
            'data': by_salesman,
            'total': round(salesman_total, 2)
        },
        'by_location': {
            'data': by_location,
            'total': round(location_total, 2)
        }
    })

@app.route('/api/sales-by-type', methods=['GET'])
def get_sales_by_type():
    """Get Sales by Type of Sales data from latest upload
    
    Data comes from SALES BY FPR sheet - type_of_sales column
    (Distributor, HoReCa, Retail, Supermarket, Whole Sales)
    """
    year = request.args.get('year', 2025, type=int)
    month_name = request.args.get('month', 'July')
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get month_id
    cursor.execute('SELECT id FROM months WHERE name = ?', (month_name,))
    month_row = cursor.fetchone()
    if not month_row:
        conn.close()
        return jsonify({'error': f'Month {month_name} not found'}), 404
    month_id = month_row['id']
    
    # Get Sales by Type from sales_by_fpr table
    cursor.execute('''
        SELECT 
            type_of_sales,
            SUM(amount) as total_amount
        FROM sales_by_fpr
        WHERE year_id = ? AND month_id = ? AND upload_id = ?
        GROUP BY type_of_sales
        ORDER BY total_amount DESC
    ''', (year_id, month_id, latest_upload_id))
    
    by_type = []
    total = 0
    for row in cursor.fetchall():
        amount = row['total_amount']
        by_type.append({
            'name': row['type_of_sales'],
            'amount': round(amount, 2)
        })
        total += amount
    
    conn.close()
    
    return jsonify({
        'year': year,
        'month': month_name,
        'upload_id': latest_upload_id,
        'data': by_type,
        'total': round(total, 2)
    })

@app.route('/api/cost-analysis', methods=['GET', 'PUT'])
def cost_analysis():
    """GET: Retrieve Cost Analysis data, PUT: Update Fuel/LEC values"""
    if request.method == 'PUT':
        return update_cost_analysis()
    return get_cost_analysis()

def update_cost_analysis():
    """Update Fuel and LEC values for a specific month"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    year = data.get('year')
    month = data.get('month')  # month name like 'January'
    fuel = data.get('fuel')
    lec = data.get('lec')
    
    if not year or not month:
        return jsonify({'error': 'Year and month are required'}), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get latest upload ID
        latest_upload_id = get_latest_upload_id()
        if not latest_upload_id:
            conn.close()
            return jsonify({'error': 'No data available'}), 404
        
        # Get year_id
        cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
        year_row = cursor.fetchone()
        if not year_row:
            conn.close()
            return jsonify({'error': f'Year {year} not found'}), 404
        year_id = year_row['id']
        
        # Get month_id
        cursor.execute('SELECT id FROM months WHERE name = ?', (month,))
        month_row = cursor.fetchone()
        if not month_row:
            conn.close()
            return jsonify({'error': f'Month {month} not found'}), 404
        month_id = month_row['id']
        
        # Check if record exists
        cursor.execute('''
            SELECT id FROM cost_data 
            WHERE upload_id = ? AND year_id = ? AND month_id = ?
        ''', (latest_upload_id, year_id, month_id))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing record
            update_parts = []
            params = []
            
            if fuel is not None:
                update_parts.append('fuel = ?')
                params.append(fuel)
            if lec is not None:
                update_parts.append('lec = ?')
                params.append(lec)
            
            if update_parts:
                params.extend([latest_upload_id, year_id, month_id])
                cursor.execute(f'''
                    UPDATE cost_data 
                    SET {', '.join(update_parts)}
                    WHERE upload_id = ? AND year_id = ? AND month_id = ?
                ''', params)
        else:
            # Insert new record
            cursor.execute('''
                INSERT INTO cost_data (upload_id, year_id, month_id, fuel, lec)
                VALUES (?, ?, ?, ?, ?)
            ''', (latest_upload_id, year_id, month_id, fuel or 0, lec or 0))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Cost data updated for {month} {year}',
            'year': year,
            'month': month,
            'fuel': fuel,
            'lec': lec
        })
        
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

def get_cost_analysis():
    """Get Cost Analysis data (Fuel & LEC) with calculated metrics
    
    Returns monthly Fuel, LEC, Total, Cost Per Ctn, and % Of Revenue
    Includes all months that have sales data (even if no cost data exists yet)
    """
    year = request.args.get('year', 2025, type=int)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get latest upload ID
    latest_upload_id = get_latest_upload_id()
    if not latest_upload_id:
        conn.close()
        return jsonify({'error': 'No data available. Please upload an Excel file first.'}), 404
    
    # Get year_id
    cursor.execute('SELECT id FROM years WHERE year = ?', (year,))
    year_row = cursor.fetchone()
    if not year_row:
        conn.close()
        return jsonify({'error': f'Year {year} not found'}), 404
    year_id = year_row['id']
    
    # Get all months that have sales data for this year
    cursor.execute('''
        SELECT DISTINCT 
            m.id as month_id,
            m.name as month_name,
            m.month_number,
            m.short_name
        FROM sales_data sd
        JOIN months m ON sd.month_id = m.id
        WHERE sd.year_id = ? AND sd.upload_id = ?
        ORDER BY m.month_number
    ''', (year_id, latest_upload_id))
    
    months_with_sales = cursor.fetchall()
    
    # Get cost data
    cursor.execute('''
        SELECT 
            month_id,
            fuel,
            lec
        FROM cost_data
        WHERE year_id = ? AND upload_id = ?
    ''', (year_id, latest_upload_id))
    
    cost_by_month = {}
    for row in cursor.fetchall():
        cost_by_month[row['month_id']] = {
            'fuel': row['fuel'] or 0,
            'lec': row['lec'] or 0
        }
    
    # Get sales data (total qty and amount) per month for calculations
    cursor.execute('''
        SELECT 
            m.id as month_id,
            COALESCE(SUM(sd.qty_actual), 0) as total_qty,
            COALESCE(SUM(sd.amount_actual), 0) as total_amount
        FROM sales_data sd
        JOIN months m ON sd.month_id = m.id
        WHERE sd.year_id = ? AND sd.upload_id = ?
        GROUP BY m.id
    ''', (year_id, latest_upload_id))
    
    sales_by_month = {}
    for row in cursor.fetchall():
        sales_by_month[row['month_id']] = {
            'total_qty': row['total_qty'],
            'total_amount': row['total_amount']
        }
    
    conn.close()
    
    # Build result - include all months with sales data
    months_data = []
    for month_row in months_with_sales:
        month_id = month_row['month_id']
        month_num = month_row['month_number']
        
        # Get cost data for this month (or defaults)
        cost = cost_by_month.get(month_id, {'fuel': 0, 'lec': 0})
        fuel = cost['fuel']
        lec = cost['lec']
        total = fuel + lec
        
        # Get sales data for this month
        sales = sales_by_month.get(month_id, {'total_qty': 0, 'total_amount': 0})
        total_qty = sales['total_qty']
        total_amount = sales['total_amount']
        
        # Calculate Cost Per Ctn and % Of Revenue
        cost_per_ctn = total / total_qty if total_qty > 0 else 0
        pct_of_revenue = (total / total_amount * 100) if total_amount > 0 else 0
        
        months_data.append({
            'month': month_row['month_name'],
            'month_short': f"{month_row['short_name']}'{str(year)[2:]}",
            'fuel': round(fuel, 2),
            'lec': round(lec, 2),
            'total': round(total, 2),
            'cost_per_ctn': round(cost_per_ctn, 2),
            'pct_of_revenue': round(pct_of_revenue, 0)
        })
    
    return jsonify({
        'year': year,
        'upload_id': latest_upload_id,
        'data': months_data
    })

# ========== MAINTENANCE ENDPOINTS ==========

@app.route('/api/product-categories', methods=['GET'])
def get_product_categories():
    """Get all product categories with their product count"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            pc.id,
            pc.name,
            COUNT(p.id) as product_count
        FROM product_categories pc
        LEFT JOIN products p ON pc.id = p.category_id
        GROUP BY pc.id, pc.name
        ORDER BY pc.name
    ''')
    
    categories = []
    for row in cursor.fetchall():
        categories.append({
            'id': row['id'],
            'name': row['name'],
            'product_count': row['product_count']
        })
    
    conn.close()
    return jsonify({'categories': categories})

@app.route('/api/product-categories', methods=['POST'])
def create_product_category():
    """Create a new product category"""
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400
    
    name = data['name'].strip()
    
    if not name:
        return jsonify({'error': 'Category name cannot be empty'}), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if category already exists
        cursor.execute('SELECT id FROM product_categories WHERE LOWER(name) = LOWER(?)', (name,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Category "{name}" already exists'}), 409
        
        cursor.execute('INSERT INTO product_categories (name) VALUES (?)', (name,))
        category_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Category "{name}" created successfully',
            'category': {
                'id': category_id,
                'name': name,
                'product_count': 0
            }
        }), 201
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/product-categories/<int:category_id>', methods=['GET'])
def get_product_category(category_id):
    """Get a single product category with its products"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get category
    cursor.execute('SELECT id, name FROM product_categories WHERE id = ?', (category_id,))
    category_row = cursor.fetchone()
    
    if not category_row:
        conn.close()
        return jsonify({'error': 'Category not found'}), 404
    
    # Get products in this category
    cursor.execute('''
        SELECT id, name, sub_category, type_of_sales
        FROM products
        WHERE category_id = ?
        ORDER BY name
    ''', (category_id,))
    
    products = []
    for row in cursor.fetchall():
        products.append({
            'id': row['id'],
            'name': row['name'],
            'sub_category': row['sub_category'],
            'type_of_sales': row['type_of_sales']
        })
    
    conn.close()
    
    return jsonify({
        'category': {
            'id': category_row['id'],
            'name': category_row['name'],
            'products': products
        }
    })

@app.route('/api/product-categories/<int:category_id>', methods=['PUT'])
def update_product_category(category_id):
    """Update a product category"""
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400
    
    name = data['name'].strip()
    
    if not name:
        return jsonify({'error': 'Category name cannot be empty'}), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if category exists
        cursor.execute('SELECT id FROM product_categories WHERE id = ?', (category_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Category not found'}), 404
        
        # Check if new name already exists (for different category)
        cursor.execute('SELECT id FROM product_categories WHERE LOWER(name) = LOWER(?) AND id != ?', (name, category_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Category "{name}" already exists'}), 409
        
        cursor.execute('UPDATE product_categories SET name = ? WHERE id = ?', (name, category_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Category updated to "{name}"',
            'category': {
                'id': category_id,
                'name': name
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/product-categories/<int:category_id>', methods=['DELETE'])
def delete_product_category(category_id):
    """Delete a product category (only if no products are associated)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if category exists
        cursor.execute('SELECT name FROM product_categories WHERE id = ?', (category_id,))
        category_row = cursor.fetchone()
        if not category_row:
            conn.close()
            return jsonify({'error': 'Category not found'}), 404
        
        category_name = category_row['name']
        
        # Check if category has products
        cursor.execute('SELECT COUNT(*) as count FROM products WHERE category_id = ?', (category_id,))
        product_count = cursor.fetchone()['count']
        
        if product_count > 0:
            conn.close()
            return jsonify({
                'error': f'Cannot delete category "{category_name}" - it has {product_count} product(s) associated. Delete products first or reassign them to another category.'
            }), 409
        
        cursor.execute('DELETE FROM product_categories WHERE id = ?', (category_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Category "{category_name}" deleted successfully'
        })
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

# ========== PRODUCTS ENDPOINTS ==========

@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products with optional category filter"""
    category_id = request.args.get('category_id', type=int)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    if category_id:
        cursor.execute('''
            SELECT 
                p.id,
                p.name,
                p.sub_category,
                p.type_of_sales,
                p.category_id,
                pc.name as category_name
            FROM products p
            JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.category_id = ?
            ORDER BY p.name
        ''', (category_id,))
    else:
        cursor.execute('''
            SELECT 
                p.id,
                p.name,
                p.sub_category,
                p.type_of_sales,
                p.category_id,
                pc.name as category_name
            FROM products p
            JOIN product_categories pc ON p.category_id = pc.id
            ORDER BY pc.name, p.name
        ''')
    
    products = []
    for row in cursor.fetchall():
        products.append({
            'id': row['id'],
            'name': row['name'],
            'sub_category': row['sub_category'],
            'type_of_sales': row['type_of_sales'],
            'category_id': row['category_id'],
            'category_name': row['category_name']
        })
    
    conn.close()
    return jsonify({'products': products})

@app.route('/api/products', methods=['POST'])
def create_product():
    """Create a new product"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    name = (data.get('name') or '').strip()
    category_id = data.get('category_id')
    sub_category_raw = data.get('sub_category')
    type_of_sales_raw = data.get('type_of_sales')
    
    # Handle None values safely
    sub_category = sub_category_raw.strip() if sub_category_raw else None
    type_of_sales = type_of_sales_raw.strip() if type_of_sales_raw else None
    
    if not name:
        return jsonify({'error': 'Product name is required'}), 400
    
    if not category_id:
        return jsonify({'error': 'Category is required'}), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if category exists
        cursor.execute('SELECT name FROM product_categories WHERE id = ?', (category_id,))
        category_row = cursor.fetchone()
        if not category_row:
            conn.close()
            return jsonify({'error': 'Category not found'}), 404
        
        # Check if product already exists in this category
        cursor.execute('SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND category_id = ?', (name, category_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Product "{name}" already exists in category "{category_row["name"]}"'}), 409
        
        cursor.execute('''
            INSERT INTO products (name, category_id, sub_category, type_of_sales)
            VALUES (?, ?, ?, ?)
        ''', (name, category_id, sub_category, type_of_sales))
        product_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Product "{name}" created successfully',
            'product': {
                'id': product_id,
                'name': name,
                'category_id': category_id,
                'category_name': category_row['name'],
                'sub_category': sub_category,
                'type_of_sales': type_of_sales
            }
        }), 201
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """Update a product"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if product exists
        cursor.execute('SELECT id, name, category_id FROM products WHERE id = ?', (product_id,))
        product_row = cursor.fetchone()
        if not product_row:
            conn.close()
            return jsonify({'error': 'Product not found'}), 404
        
        # Build update query dynamically
        updates = []
        params = []
        
        if 'name' in data:
            name = data['name'].strip()
            if not name:
                conn.close()
                return jsonify({'error': 'Product name cannot be empty'}), 400
            updates.append('name = ?')
            params.append(name)
        
        if 'category_id' in data:
            category_id = data['category_id']
            cursor.execute('SELECT id FROM product_categories WHERE id = ?', (category_id,))
            if not cursor.fetchone():
                conn.close()
                return jsonify({'error': 'Category not found'}), 404
            updates.append('category_id = ?')
            params.append(category_id)
        
        if 'sub_category' in data:
            updates.append('sub_category = ?')
            params.append(data['sub_category'].strip() if data['sub_category'] else None)
        
        if 'type_of_sales' in data:
            updates.append('type_of_sales = ?')
            params.append(data['type_of_sales'].strip() if data['type_of_sales'] else None)
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        params.append(product_id)
        update_sql = 'UPDATE products SET ' + ', '.join(updates) + ' WHERE id = ?'
        cursor.execute(update_sql, params)
        conn.commit()
        
        # Get updated product
        cursor.execute('''
            SELECT p.*, pc.name as category_name
            FROM products p
            JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.id = ?
        ''', (product_id,))
        updated = cursor.fetchone()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Product updated successfully',
            'product': {
                'id': updated['id'],
                'name': updated['name'],
                'category_id': updated['category_id'],
                'category_name': updated['category_name'],
                'sub_category': updated['sub_category'],
                'type_of_sales': updated['type_of_sales']
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Delete a product (only if no data is associated)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Check if product exists
        cursor.execute('SELECT name FROM products WHERE id = ?', (product_id,))
        product_row = cursor.fetchone()
        if not product_row:
            conn.close()
            return jsonify({'error': 'Product not found'}), 404
        
        product_name = product_row['name']
        
        # Check if product has associated data
        cursor.execute('SELECT COUNT(*) as count FROM sales_data WHERE product_id = ?', (product_id,))
        sales_count = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM production_data WHERE product_id = ?', (product_id,))
        production_count = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM budget_projection WHERE product_id = ?', (product_id,))
        budget_count = cursor.fetchone()['count']
        
        total_refs = sales_count + production_count + budget_count
        
        if total_refs > 0:
            conn.close()
            return jsonify({
                'error': f'Cannot delete product "{product_name}" - it has {total_refs} data record(s) associated (sales: {sales_count}, production: {production_count}, budget: {budget_count}). Delete data first.'
            }), 409
        
        cursor.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Product "{product_name}" deleted successfully'
        })
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM sales_data')
    count = cursor.fetchone()['count']
    
    latest_upload_id = get_latest_upload_id()
    
    conn.close()
    
    return jsonify({
        'status': 'healthy',
        'data_loaded': count > 0,
        'records': count,
        'latest_upload_id': latest_upload_id
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)
