'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [roomId, setRoomId] = useState('');

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Video Stream App
          </h1>
          <p className="text-gray-600">
            Stream video and audio between devices using WebRTC
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter or generate room ID"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                maxLength={6}
              />
              <button
                onClick={generateRoomId}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <Link
              href={`/stream?room=${roomId}`}
              className={`w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-md text-white transition-colors ${
                roomId
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={(e) => {
                if (!roomId) e.preventDefault();
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start Streaming
            </Link>

            <Link
              href={`/watch?room=${roomId}`}
              className={`w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-md transition-colors border-2 ${
                roomId
                  ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
                  : 'border-gray-400 text-gray-400 cursor-not-allowed'
              }`}
              onClick={(e) => {
                if (!roomId) e.preventDefault();
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-10 5a7 7 0 1114 0H5z" />
              </svg>
              Watch Stream
            </Link>
          </div>

          <div className="text-xs text-gray-500 text-center">
            <p>• Use the same Room ID on both devices</p>
            <p>• One device streams, others watch</p>
            <p>• Works best on the same network</p>
          </div>
        </div>
      </div>
    </div>
  );
}