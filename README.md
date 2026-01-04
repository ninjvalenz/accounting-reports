# Sales Performance Dashboard 2025

A Python + React application that replicates the Excel dashboard functionality for sales performance analysis.

## Project Structure

```
SalesReport/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── uploads/            # Uploaded Excel files (created at runtime)
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.js
│   │   │   └── ComparisonSales.js
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
└── README.md
```

## Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

## Installation & Running

### Backend (Python/Flask)

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd D:\Development\SalesReport\backend
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the Flask server:
   ```bash
   python app.py
   ```
   
   The API will be running at http://localhost:5001

### Frontend (React)

1. Open another terminal and navigate to the frontend folder:
   ```bash
   cd D:\Development\SalesReport\frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```
   
   The app will open at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Upload your Sales Performance Excel file (must follow the template format)
3. Use the month dropdown to view different periods
4. The dashboard will display:
   - Comparison - Sales (Budget vs Actual)
   - (More sections to be added)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload Excel file |
| `/api/months` | GET | Get available months |
| `/api/comparison-sales` | GET | Get sales comparison data |
| `/api/health` | GET | Health check |

## Current Features

- [x] File upload
- [x] Comparison - Sales (Budget vs Actual)
- [ ] Comparison - Production (Budget vs Actual)
- [ ] Sales Category Wise
- [ ] Production Category Wise
- [ ] YoY Growth
- [ ] MoM Growth
- [ ] Sales by Location by Sales Man
