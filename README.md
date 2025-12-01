# Sales Performance Dashboard

A React-based POC that processes Excel files and displays a dashboard **exactly matching** the Dashboard-1 sheet from your Excel file.

## Features

- **Excel Upload**: Drag & drop or click to upload `.xlsx` files
- **Exact Dashboard Replication**: Tables matching Dashboard-1 layout
- **Sections Displayed**:
  - Comparison - Sales (Budget vs Actual)
  - Comparison - Production (Budgeted vs Actual)
  - Sales Category Wise
  - Production Category Wise
  - YoY Growth (Quantity & Amount)
  - MoM Growth
  - Sales by Salesperson
  - Sales by Location
  - Sales by Type
- **Month Filter**: Switch between months
- **JSON Export**: Save calculated data for storage

## Quick Start

### 1. Install Dependencies
```bash
cd D:\Development\SalesReport
npm install
```

### 2. Start the App
```bash
npm start
```

### 3. Open Browser
Go to [http://localhost:3000](http://localhost:3000)

### 4. Upload Your Excel File
The app requires these sheets:
- `Data`
- `Product Master`
- `Production Data`
- `Customer Master`
- `SALES BY FPR`
- `Day (in Month)`
- `Sales Projection 2025`

## Project Structure

```
SalesReport/
├── public/
│   └── index.html
├── sample_data/
│   └── Sales_Perfomance_2025.xlsx
├── src/
│   ├── components/
│   │   └── SalesDashboard.jsx      ← Main dashboard (all tables)
│   ├── hooks/
│   │   └── useExcelParser.js       ← Excel parsing hook
│   ├── utils/
│   │   ├── calculations.js         ← All dashboard calculations
│   │   └── formatters.js           ← Number/currency formatting
│   ├── App.jsx
│   └── index.jsx
├── package.json
└── README.md
```

## Why .jsx Extension?

`.jsx` is used for React component files because:
1. **Semantic clarity** - Indicates the file contains JSX syntax
2. **Better IDE support** - Some editors provide better syntax highlighting
3. **Explicit intent** - Makes it clear this is a React component, not plain JS

Both `.js` and `.jsx` work with Create React App, but `.jsx` is more explicit.

## Storage Recommendations

| Option | Use Case |
|--------|----------|
| **JSON Export** | Simple storage, backup, sharing |
| **SQLite** | Local apps needing queries |
| **PostgreSQL** | Multi-user, enterprise apps |

The app includes a JSON export button - click "Export JSON" to save all calculated data.

## Tech Stack

- **React 18** - UI framework
- **SheetJS (xlsx)** - Excel parsing
- **Tailwind CSS** - Styling (via CDN)
- **Lucide React** - Icons

## Scripts

```bash
npm start      # Development server
npm run build  # Production build
```

## License

MIT
