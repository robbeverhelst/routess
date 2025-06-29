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
        # Replace environment variable placeholders with actual values
        if [ -n "$VITE_MAPBOX_ACCESS_TOKEN" ]; then
            # Remove any newlines from the token
            CLEAN_TOKEN=$(echo "$VITE_MAPBOX_ACCESS_TOKEN" | tr -d '\n\r')
            # Use a temporary file to avoid permission issues with sed -i
            if sed "s#__VITE_MAPBOX_ACCESS_TOKEN__#${CLEAN_TOKEN}#g" "$file" > "$file.tmp" 2>/dev/null; then
                mv "$file.tmp" "$file" 2>/dev/null || rm -f "$file.tmp"
                echo "Replaced __VITE_MAPBOX_ACCESS_TOKEN__ with actual token"
            else
                echo "Could not modify $file - using original"
                rm -f "$file.tmp"
            fi
        fi
    else
        echo "No placeholder __VITE_MAPBOX_ACCESS_TOKEN__ found in $file"
    fi
    
    # Use the same approach for other environment variables
    if [ -n "$VITE_GOOGLE_CLIENT_ID" ]; then
        sed "s#__VITE_GOOGLE_CLIENT_ID__#${VITE_GOOGLE_CLIENT_ID}#g" "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || rm -f "$file.tmp"
    fi
    
    if [ -n "$VITE_APP_URL" ]; then
        sed "s#__VITE_APP_URL__#${VITE_APP_URL}#g" "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || rm -f "$file.tmp"
    fi
    
    if [ -n "$VITE_API_URL" ]; then
        sed "s#__VITE_API_URL__#${VITE_API_URL}#g" "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || rm -f "$file.tmp"
    fi
    
    if [ -n "$VITE_APP_VERSION" ]; then
        sed "s#__VITE_APP_VERSION__#${VITE_APP_VERSION}#g" "$file" > "$file.tmp" 2>/dev/null && mv "$file.tmp" "$file" 2>/dev/null || rm -f "$file.tmp"
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

# Create nginx cache directories with proper permissions
echo "Setting up nginx cache directories..."
mkdir -p /var/cache/nginx/client_temp
mkdir -p /var/cache/nginx/proxy_temp  
mkdir -p /var/cache/nginx/fastcgi_temp
mkdir -p /var/cache/nginx/uwsgi_temp
mkdir -p /var/cache/nginx/scgi_temp

# Ensure nginx has write permissions to cache directories
chmod 755 /var/cache/nginx
chmod 755 /var/cache/nginx/*

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"