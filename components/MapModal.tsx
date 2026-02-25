'use client';

import React, { useEffect, useRef } from 'react';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  ports: { id: string; name: string; lat: number; lng: number; name_ko?: string; city?: string; country?: string; }[];
}

// Google Maps API 스크립트를 동적으로 로드하는 함수
const loadGoogleMapsScript = (apiKey: string) => {
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    window.initMap = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Google Maps script could not be loaded.'));
    };
  });
};

declare global {
  interface Window {
    initMap: () => void;
    google: any; // Google Maps API 객체를 전역으로 선언
  }
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, ports }) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && mapRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key is not defined.");
        return;
      }

      loadGoogleMapsScript(apiKey).then(() => {
        if (!window.google || !window.google.maps) {
          console.error("Google Maps API not available after loading.");
          return;
        }

        const mapOptions: any = {
          center: { lat: 0, lng: 0 }, // 초기 중심점 (나중에 조정됨)
          zoom: 2, // 초기 줌 레벨 (나중에 조정됨)
          gestureHandling: 'cooperative', // 모바일에서 두 손가락으로만 확대/축소
        };
        const map = new window.google.maps.Map(mapRef.current, mapOptions);

        const bounds = new window.google.maps.LatLngBounds();
        const infoWindow = new window.google.maps.InfoWindow();

        ports.forEach(port => {
          const position = { lat: port.lat, lng: port.lng };
          const marker = new window.google.maps.Marker({
            position,
            map,
            title: port.name,
          });

          marker.addListener('click', () => {
            infoWindow.setContent(`<div><strong>${port.name_ko || port.name}</strong><br/>${port.city}, ${port.country}</div>`);
            infoWindow.open(map, marker);
          });

          bounds.extend(position);
        });

        if (ports.length > 0) {
          map.fitBounds(bounds); // 모든 마커를 포함하도록 지도 범위 조정
          if (map.getZoom() > 15) {
            map.setZoom(15); // 너무 확대되는 것을 방지
          }
        } else {
          map.setCenter({ lat: 0, lng: 0 });
          map.setZoom(2);
        }
      }).catch(error => console.error(error));
    }
  }, [isOpen, ports]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90%',
        overflowY: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
        <h2 style={{ marginBottom: '15px' }}>크루즈 터미널 지도</h2>
        <div id="map" ref={mapRef} style={{
          height: '400px',
          width: '100%',
          backgroundColor: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '15px',
          color: '#666',
          fontSize: '18px',
        }}>
          {/* [지도 표시 영역 - 실제 지도 API 연동 필요] */}
          {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <div>Google Maps API 키가 설정되지 않았습니다.</div>
          )}
        </div>
        <h3>관련 터미널 목록:</h3>
        <ul style={{ listStyleType: 'disc', marginLeft: '20px' }}>
          {ports.map(port => (
            <li key={port.id}>{port.name} (Lat: {port.lat}, Lng: {port.lng})</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MapModal;
