import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'medium' }) => {
  const sizeClasses = {
    small: 'h-8 w-8',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  const iconSize = sizeClasses[size];
  const textSize = size === 'small' ? 'text-lg' : size === 'medium' ? 'text-xl' : 'text-2xl';

  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        <svg
          className={`${iconSize} text-primary`}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base circle */}
          <circle cx="50" cy="50" r="45" fill="currentColor" />
          
          {/* Inner white circle */}
          <circle cx="50" cy="50" r="38" fill="white" />
          
          {/* Bridge "S" shape */}
          <path
            d="M35 30C35 30 45 30 50 30C55 30 65 30 65 40C65 50 55 50 50 50C45 50 35 50 35 60C35 70 45 70 50 70C55 70 65 70 65 70"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Connecting dots */}
          <circle cx="35" cy="30" r="5" fill="currentColor" />
          <circle cx="65" cy="70" r="5" fill="currentColor" />
          
          {/* Sync arrows */}
          <path
            d="M75 25C75 25 85 35 75 45"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M25 75C25 75 15 65 25 55"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      
      {showText && (
        <div className={`ml-2 font-bold ${textSize} bg-gradient-to-r from-primary to-primary-600 bg-clip-text text-transparent`}>
          SyncBridge
        </div>
      )}
    </div>
  );
};

export default Logo;