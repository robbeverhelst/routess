#!/bin/sh

# Runtime environment variable replacement for static frontend files
# This script replaces placeholder values with actual environment variables at container startup

echo "Starting entrypoint script for runtime configuration..."

# Define the files to process
HTML_FILE="/usr/share/nginx/html/index.html"
SW_FILE="/usr/share/nginx/html/sw.js"
JS_FILES="/usr/share/nginx/html/assets/*.js"

replace_token() {
    local file="$1"
    local placeholder="$2"
    local value="$3"
    local escaped_value

    escaped_value=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')
    sed -i "s|${placeholder}|${escaped_value}|g" "$file"
}

# Function to replace placeholders in files
replace_placeholders() {
    local file="$1"
    
    echo "Processing file: $file"
    
    # Check if placeholder exists in file
    if grep -q "__VITE_MAPBOX_ACCESS_TOKEN__" "$file"; then
        echo "Found placeholder __VITE_MAPBOX_ACCESS_TOKEN__ in $file"
        # Replace environment variable placeholders with actual values
        # Remove any newlines from the token
        CLEAN_TOKEN=$(printf '%s' "${VITE_MAPBOX_ACCESS_TOKEN:-}" | tr -d '\n\r')
        replace_token "$file" "__VITE_MAPBOX_ACCESS_TOKEN__" "$CLEAN_TOKEN"
        echo "Replaced __VITE_MAPBOX_ACCESS_TOKEN__"
        # Verify replacement worked
        if grep -q "__VITE_MAPBOX_ACCESS_TOKEN__" "$file"; then
            echo "ERROR: Replacement failed, placeholder still exists!"
        else
            echo "SUCCESS: Placeholder replaced successfully"
        fi
    else
        echo "No placeholder __VITE_MAPBOX_ACCESS_TOKEN__ found in $file"
    fi
    
    replace_token "$file" "__VITE_GOOGLE_CLIENT_ID__" "${VITE_GOOGLE_CLIENT_ID:-}"
    replace_token "$file" "__VITE_APP_URL__" "${VITE_APP_URL:-}"
    replace_token "$file" "__VITE_API_URL__" "${VITE_API_URL:-}"
    replace_token "$file" "__VITE_APP_VERSION__" "${VITE_APP_VERSION:-}"
    replace_token "$file" "__VITE_STADIA_API_KEY__" "${VITE_STADIA_API_KEY:-}"
    
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

# Process service worker file
if [ -f "$SW_FILE" ]; then
    replace_placeholders "$SW_FILE"
fi

echo "Environment variable replacement completed."

# Start nginx
echo "Starting nginx..."
exec nginx -g "daemon off;"
