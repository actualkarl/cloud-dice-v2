# Changelog

All notable changes to Cloud Dice V2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **BREAKING**: Room IDs now 16 characters (was 6) for cryptographic security
- **BREAKING**: All user inputs are now sanitized and length-limited
- Added comprehensive rate limiting for room creation (5 per IP per 15 minutes)
- Implemented IP-based connection limits (max 5 concurrent per IP)
- Added security headers with helmet.js and Content Security Policy
- Removed public room info API endpoint for security
- Added automatic cleanup of rate limiting and connection tracking data
- Implemented secure IP hashing instead of storing raw IP addresses

### Added
- Real-time chat system with WebSocket communication
- Dice rolls automatically posted to chat feed
- Collapsible chat panel with message count display
- Auto-scroll to newest messages in chat
- Player names and timestamps for all messages
- Input validation and sanitization for all user data
- Comprehensive security documentation (SECURITY.md)
- Environment configuration for security variables

### Changed
- Room creation now uses cryptographically secure random IDs
- Chat messages limited to 200 characters (was 500)
- Player names limited to 20 characters
- Last dice roll result now persists (doesn't auto-clear)
- Enhanced error handling with descriptive security messages
- Improved server logging with hashed IP tracking

### Fixed
- JSX syntax errors in GameRoom component causing export failures
- Missing div closing tags in component structure
- Proper input sanitization preventing XSS attacks
- Memory leaks from unlimited data accumulation

### Infrastructure
- Added helmet.js for security headers
- Added express-rate-limit for DOS protection  
- Added validator.js for input sanitization
- Updated .env.example with security configuration
- Added periodic cleanup routines for data hygiene

---

## [1.0.0] - Initial Release

### Added
- Multiplayer dice rolling with WebSocket support
- Room creation and joining system
- Support for multiple dice types (d2, d4, d6, d8, d10, d12, d20, d100)
- Real-time player management
- Dice roll history tracking
- Responsive web interface
- Express.js backend with Socket.io
- React frontend with modern hooks
- Room cleanup and management
- Basic error handling
- CORS configuration for development

### Features
- Create rooms with custom player limits (2-16 players)
- Join rooms with unique room IDs  
- Roll single or multiple dice with custom labels
- View recent roll history for all players
- Host transfer on player disconnect
- Automatic room cleanup after inactivity
- Copy room ID to clipboard
- Real-time player join/leave notifications

### Technical
- Node.js backend with ES modules
- React 18 with Vite build system
- Socket.io for real-time communication
- In-memory data storage for rooms and players
- RESTful API for health checks and dice rolling
- Environment-based configuration
- Railway deployment ready