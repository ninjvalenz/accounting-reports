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
    app.run(debug=True, port=5001)
