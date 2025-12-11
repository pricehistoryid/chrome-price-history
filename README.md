# Price History ID

<div align="center">

![PriceHistoryID Logo](public/icon/128.png)

**E-commerce Price Tracker Extension**

![License](https://img.shields.io/badge/license-MIT-green)
[![Release](https://github.com/pricehistoryid/chrome-price-history/workflows/Release/badge.svg)](https://github.com/pricehistoryid/chrome-price-history/releases)

</div>

---

A Chrome extension for tracking price history from Indonesian online marketplaces. Monitor price fluctuations and get insights on product pricing trends across Tokopedia, Shopee, Lazada, and Blibli.

![PriceHistoryID Promotional GIF](assets/screen-record.gif)

## Features

### Current Features
- **Price History Charts**: Interactive charts showing price trends over time
- **Lowest Price Tracking**: Automatically track and highlight the lowest recorded price
- **Local Storage**: Store price history locally in your browser
- **API Synchronization**: Sync data with pricehistory.id for enhanced tracking
- **Real-time Updates**: Automatic price updates when browsing products
- **E-commerce Support**: Complete price tracking and chart display from e-commerce products
  - **Tokopedia**: Track prices from Tokopedia product page, search page, and wishlist page

## Installation

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/chrome-price-history.git
   cd chrome-price-history
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

5. Load in Firefox:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" and then "Load Temporary Add-on"
   - Select the `dist` folder

## Development Setup

### Prerequisites
- Node.js 18+
- npm or pnpm

### Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Development server:
   ```bash
   # Chrome development
   pnpm dev

   # Firefox development
   pnpm dev:firefox
   ```

3. Build for production:
   ```bash
   # Chrome build
   pnpm build

   # Firefox build
   pnpm build:firefox
   ```

4. Create distribution packages:
   ```bash
   # Chrome package
   pnpm zip

   # Firefox package
   pnpm zip:firefox
   ```

### Project Structure
```
chrome-price-history/
├── entrypoints/
│   ├── content/          # Content scripts
│   │   ├── v3/          # Latest version with TypeScript
│   │   ├── v2/          # Legacy version
│   │   └── v1/          # Original version
│   └── background.ts    # Background script
├── public/              # Static assets
├── assets/              # Extension assets
├── wxt.config.ts       # WXT configuration
└── package.json        # Project dependencies
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Process
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit your changes: `git commit -m 'feat: add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- Use TypeScript for new features
- Follow ESLint configuration
- Write clear, concise comments
- Test your changes on both Chrome and Firefox

### Testing
- Test on latest Chrome and Firefox versions
- Verify functionality on actual Tokopedia pages
- Check for console errors and warnings

### Important Notes
- Tokopedia affiliate links are currently disabled
- The extension focuses on Indonesian marketplaces
- All data is stored locally until API synchronization is available

## Technology Stack

- **WXT**: Modern Chrome extension framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tooling
- **Lightweight Charts**: TradingView charting library
- **Tailwind CSS**: Utility-first CSS framework

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Open an issue on GitHub
- Check the [TODO.md](TODO.md) file for planned features
- Review the [CHANGELOG.md](CHANGELOG.md) for recent updates

## Acknowledgments

- Built with [WXT](https://wxt.dev/) - The modern Chrome extension framework
- Charts powered by [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- Inspired by price tracking tools from around the web

---

Made for the Indonesian shopping community
