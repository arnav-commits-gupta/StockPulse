# StockPulse Pro
StockPulse Pro is an intelligent stock market analysis platform that leverages artificial intelligence and real-time data to help investors make informed trading decisions. Built with React, TypeScript, and Flask, StockPulse provides a modern, comprehensive interface for stock research, prediction, and portfolio tracking.

🚀 Tech Stack
Frontend
React 18 with TypeScript
Vite (Build Tool)
Shadcn UI Components
Tailwind CSS
React Query (Data Fetching)
TanStack React Query
Chart.js & Recharts (Charting)
Framer Motion (Animations)
Lucide Icons

Backend
Python 3.9+
Flask
Pandas & NumPy (Data Processing)
Scikit-learn (ML Models)
yfinance (Stock Data API)
Flask-CORS
ReportLab (PDF Export)

🌟 Features in Detail
📊 Live Stock Quotes
Real-time stock price tracking for 81+ instruments
Comprehensive quote data (price, change, volume, PE ratio, etc.)
Support for US stocks, cryptocurrencies, and Indian stocks
Search and filter by symbol or company name
Watchlist management with custom selections

📈 Advanced Technical Charts
Interactive candlestick charts with multiple timeframes
1 minute to 1 week intervals
Professional technical indicators:
- Simple Moving Averages (SMA 20/50)
- Exponential Moving Averages (EMA 20)
- Relative Strength Index (RSI)
- MACD with signal line and histogram
- Bollinger Bands
- Volume Moving Average
Zoom and pan capabilities
Real-time data updates

🤖 AI-Powered Price Prediction
Auto-train ML models on-demand
Three prediction algorithms:
- Linear Regression (Fast)
- Random Forest (Accurate)
- Gradient Boosting (Best Quality)
Multiple timeframe support (1m, 5m, 15m, 1h, 4h, 1d, 1wk)
Automatic feature engineering from OHLCV data
Model performance metrics (R², MAE, RMSE)
Visual forecast charts
Train/test split analysis

📋 Watchlist Management
Save favorite stocks
Quick access sidebar with search
Symbol and company name search
Price alerts and notifications
Customizable watchlist

🔄 Robust Error Handling
Fallback mock data when API is rate-limited
Intelligent retry logic with exponential backoff
5-minute caching to reduce API calls
Graceful degradation for offline scenarios
Rate limit detection and recovery

🎨 Modern User Interface
Clean, professional design
Dark/Light mode support
Responsive layouts for desktop, tablet, mobile
Smooth animations and transitions
Real-time updates
Loading states and error messages

📦 Data Coverage
81+ carefully selected instruments across:
- Tech Giants (Apple, Google, Microsoft, etc.)
- Financial Services (JPMorgan, Goldman Sachs, etc.)
- Healthcare & Pharma (J&J, Pfizer, Moderna, etc.)
- Energy (Exxon, Chevron, Shell, etc.)
- Consumer & Retail (Walmart, Costco, Nike, etc.)
- Industrial & Manufacturing (Boeing, Caterpillar, etc.)
- Utilities (NextEra, Duke Energy, etc.)
- Cryptocurrencies (Bitcoin, Ethereum, BNB, etc.)
- Indian Stocks (TCS, Infosys, Reliance, HDFC Bank, etc.)
- European & Emerging Markets

⚡ Performance Features
Request throttling (3-second minimum delay)
5-minute data caching
Lazy-loaded charts and data
Optimized API calls
Memory-efficient data processing

🔐 API Features
RESTful API architecture
CORS enabled for frontend integration
JSON request/response format
Error handling with meaningful messages
Mock data fallback system
Rate limit awareness


📁 Project Structure
```
demo/
├── app.py                 # Flask backend server
├── src/
│   ├── App.tsx           # Main React app
│   ├── components/       # React components
│   │   ├── QuoteCard.tsx
│   │   ├── StockChart.tsx
│   │   ├── Predictor.tsx
│   │   ├── Watchlist.tsx
│   │   └── ui/          # Shadcn UI components
│   ├── lib/
│   │   ├── api.ts       # API client & data types
│   │   └── utils.ts     # Utility functions
│   ├── pages/
│   │   └── Index.tsx    # Main page
│   └── styles/          # CSS files
├── package.json          # Frontend dependencies
└── requirements.txt      # Python dependencies
```


❤️ Made with Love by Arnav Gupta
StockPulse Pro helps investors make smarter decisions through data-driven insights and AI-powered analysis.