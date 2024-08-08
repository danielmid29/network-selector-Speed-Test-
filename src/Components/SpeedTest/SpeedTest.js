import React, { useState, useEffect } from "react";
import SpeedMeterGauge from "./SpeedMeterGauge";
import "./speedtest.css";
const SpeedTest = ({ title, speed, maxValue }) => {
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [progress, setProgress] = useState(0);

  // useEffect(() => {
  //   // Simulate a speed test (replace with actual API call)
  //   const intervalId = setInterval(() => {
  //     setDownloadSpeed((prevSpeed) => prevSpeed + 1);
  //     setProgress((prevProgress) => prevProgress + 10);
  //     if (progress >= 100) {
  //       clearInterval(intervalId);
  //     }
  //   }, 1000);
  // }, []);

  return (
    <div className="speed-test">
      <div className="gauge">
        <SpeedMeterGauge value={speed} max={100} label="Download Speed" />
        <div className="st-title">{title}</div>
      </div>
    </div>
  );
};

export default SpeedTest;
