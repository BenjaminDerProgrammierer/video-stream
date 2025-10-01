# Video Stream App

A Next.js web application that enables real-time video and audio streaming between devices using WebRTC technology.

## Features

- 📱 **Phone-to-Device Streaming**: Stream video and audio from your phone to any other device
- 🎥 **Real-time Communication**: Low-latency WebRTC peer-to-peer connections
- 🔄 **Bi-directional Audio/Video**: Full duplex communication support
- 📺 **Fullscreen Mode**: Watch streams in fullscreen for better viewing experience
- 🎛️ **Media Controls**: Toggle camera and microphone during streaming
- 🏠 **Room-based**: Simple room ID system for connecting devices
- 📱 **Mobile Responsive**: Optimized for both mobile and desktop devices

## How to Use

### 1. Start the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Set Up a Stream

1. **Generate or Enter a Room ID**: On the home page, either generate a random room ID or enter a custom one (6 characters max)

2. **Start Streaming**: 
   - On the device you want to stream FROM (e.g., your phone), click "Start Streaming"
   - Allow camera and microphone permissions when prompted
   - The app will capture video from your camera and audio from your microphone

3. **Watch the Stream**:
   - On the device you want to stream TO, enter the same Room ID
   - Click "Watch Stream" 
   - Connect to see the live video and audio feed

### 3. Stream Controls

**For Streamers:**
- **Start/Stop Streaming**: Begin or end the stream
- **Toggle Camera**: Turn video on/off during streaming
- **Toggle Microphone**: Mute/unmute audio during streaming
- **Viewer Count**: See how many people are watching

**For Viewers:**
- **Fullscreen Mode**: Click the fullscreen button to expand the video
- **Volume Controls**: Use the video player controls to adjust audio
- **Connection Status**: See if you're connected to the stream

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **WebRTC**: Simple-peer library for peer-to-peer connections
- **Real-time Communication**: Socket.IO for signaling
- **Media Capture**: WebRTC getUserMedia API

## Architecture

1. **WebRTC Signaling**: Socket.IO handles the initial handshake between devices
2. **Peer Connection**: Once connected, video/audio data flows directly between devices
3. **Room Management**: Simple room-based system to match streamers with viewers
4. **Media Stream**: Uses browser APIs to capture camera/microphone input

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+  
- ✅ Safari 14+
- ✅ Edge 80+

**Note**: HTTPS is required for camera/microphone access in production deployments.

## Network Requirements

- **Local Network**: Works best when devices are on the same Wi-Fi network
- **Internet**: Can work over the internet, but may require STUN/TURN servers for NAT traversal
- **Firewall**: Ensure WebRTC ports are not blocked (UDP ports for media)

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Environment Variables

For production deployments, you may want to configure:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Set to 'production' for production builds

## Security Considerations

- Camera and microphone access requires user permission
- WebRTC connections are encrypted by default
- Room IDs provide basic access control
- Consider implementing authentication for production use

## Troubleshooting

### Camera/Microphone Not Working
- Ensure browser permissions are granted
- Check that no other app is using the camera
- Try refreshing the page and re-granting permissions

### Connection Issues
- Verify both devices are using the same Room ID
- Check network connectivity
- Ensure firewall isn't blocking WebRTC traffic
- Try refreshing both devices

### Poor Video Quality
- Check internet connection speed
- Ensure devices have sufficient processing power
- Consider reducing video resolution in browser settings
