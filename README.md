# Maps Routing Application

A web-based mapping application with advanced routing capabilities built using React, TypeScript, and Mapbox GL JS. This project allows users to plot routes, add waypoints, and calculate distances and estimated travel times.

## Features

- **Interactive Map**: Full-screen, interactive map with smooth zooming and panning
- **Location Tracking**: Centers on user's location with pulsing blue indicator
- **Multiple Routing Options**:
  - Regular waypoints that snap to the nearest road
  - Direct waypoints for straight-line travel (as the crow flies)
- **Route Management**:
  - Add waypoints by clicking on the map
  - Remove waypoints with right-click context menu
  - Undo/Redo functionality for waypoint changes
  - Reset route with a single click
- **Detailed Information**:
  - Distance calculations in kilometers
  - Estimated travel time in minutes

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Mapping**: Mapbox GL JS and React Map GL
- **Styling**: Tailwind CSS with custom animations
- **Build Tool**: Vite

## Setup and Installation

### Prerequisites

- Node.js 18+ and Bun
- A Mapbox account and access token

### Getting Started

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/maps.git
   cd maps
   ```

2. Install dependencies:

   ```
   bun install
   ```

3. Create a `.env` file in the project root with your Mapbox access token:

   ```
   VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   ```

4. Start the development server:

   ```
   bun dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Usage Instructions

- **Add Waypoints**: Click on the map to add waypoints
- **Add Direct Waypoints**: Right-click and select "Add direct waypoint"
- **Remove Waypoints**: Right-click on a waypoint and select "Remove point"
- **Undo/Redo**: Use the top-right controls to undo or redo waypoint actions
- **Reset Route**: Click the reset button in the top-right controls
- **Find Your Location**: Click the locate button to center the map on your current position
- **View Route Details**: Route distance and duration are displayed in the bottom-right card

## Security Notes

- Your Mapbox API key should be stored in a `.env` file
- The `.env` file is included in `.gitignore` and should never be committed to version control
- If you accidentally commit your API key, follow best practices to reset it:
  1. Revoke the compromised token in your Mapbox account
  2. Generate a new token
  3. Update your `.env` file with the new token

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
