#!/bin/sh

# Runtime environment variable replacement for static frontend files
# This script replaces placeholder values with actual environment variables at container startup

echo "Starting entrypoint script for runtime configuration..."

# Define the HTML and JS files to process
HTML_FILE="/usr/share/nginx/html/index.html"
JS_FILES="/usr/share/nginx/html/assets/*.js"

# Function to replace placeholders in files
replace_placeholders() {
    local file="$1"
    
    echo "Processing file: $file"
    echo "VITE_MAPBOX_ACCESS_TOKEN value: $VITE_MAPBOX_ACCESS_TOKEN"
    
    # Check if placeholder exists in file
    if grep -q "__VITE_MAPBOX_ACCESS_TOKEN__" "$file"; then
        echo "Found placeholder __VITE_MAPBOX_ACCESS_TOKEN__ in $file"
    else
        echo "No placeholder __VITE_MAPBOX_ACCESS_TOKEN__ found in $file"
    fi
    
    # Replace environment variable placeholders with actual values
    if [ -n "$VITE_MAPBOX_ACCESS_TOKEN" ]; then
        sed -i "s|__VITE_MAPBOX_ACCESS_TOKEN__|$VITE_MAPBOX_ACCESS_TOKEN|g" "$file"
        echo "Replaced __VITE_MAPBOX_ACCESS_TOKEN__ with actual token"
    fi
    
    if [ -n "$VITE_GOOGLE_CLIENT_ID" ]; then
        sed -i "s|__VITE_GOOGLE_CLIENT_ID__|$VITE_GOOGLE_CLIENT_ID|g" "$file"
    fi
    
    if [ -n "$VITE_APP_URL" ]; then
        sed -i "s|__VITE_APP_URL__|$VITE_APP_URL|g" "$file"
    fi
    
    if [ -n "$VITE_API_URL" ]; then
        sed -i "s|__VITE_API_URL__|$VITE_API_URL|g" "$file"
    fi
    
    if [ -n "$VITE_APP_VERSION" ]; then
        sed -i "s|__VITE_APP_VERSION__|$VITE_APP_VERSION|g" "$file"
    fi
    
    echo "Processed: $file"
}

# Process HTML file if it exists
if [ -f "$HTML_FILE" ]; then
    replace_placeholders "$HTML_FILE"
fi

# Process all JavaScript files
for js_file in $JS_FILES; do
    if [ -f "$js_file" ]; then
        replace_placeholders "$js_file"
    fi
done

echo "Environment variable replacement completed."

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"