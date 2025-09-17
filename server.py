#!/usr/bin/env python3
"""
Simple HTTP Server for Dynamic Event Scheduler Frontend
Run this to serve the web interface locally
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

# Configuration
PORT = 8000
HOST = 'localhost'

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()

def main():
    # Change to the directory containing the files
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if required files exist
    required_files = ['index.html', 'styles.css', 'script.js']
    missing_files = [f for f in required_files if not os.path.exists(f)]
    
    if missing_files:
        print(f"❌ Missing required files: {', '.join(missing_files)}")
        print("Please ensure all frontend files are in the same directory as this server script.")
        sys.exit(1)
    
    # Start the server
    with socketserver.TCPServer((HOST, PORT), CustomHTTPRequestHandler) as httpd:
        print("🚀 Dynamic Event Scheduler Server Starting...")
        print(f"📁 Serving files from: {script_dir}")
        print(f"🌐 Server running at: http://{HOST}:{PORT}")
        print(f"📱 Open your browser and go to: http://localhost:{PORT}")
        print("\n✨ Features available:")
        print("   • Interactive event scheduling")
        print("   • Visual conflict graph")
        print("   • Timeline view")
        print("   • Real-time updates")
        print("   • Export functionality")
        print("\nPress Ctrl+C to stop the server")
        print("=" * 50)
        
        try:
            # Try to open browser automatically
            webbrowser.open(f'http://{HOST}:{PORT}')
        except Exception:
            pass  # Browser opening is optional
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped by user")
            print("Thank you for using Dynamic Event Scheduler!")

if __name__ == "__main__":
    main()
