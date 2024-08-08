import React from "react";
import { Gauge } from "react-circular-gauge";
import "./speedtest.css";

const SpeedMeterGauge = ({ value, max, label }) => {
  return (
    <div className="speed-meter-gauge">
      <Gauge
        value={value}
        max={max}
        width={50}
        height={50}
        label={label}
        arcColor={"#1e5320"}
        trackColor={"#66bb6a"}
        segments={[
          { value: 0, color: "#ccc" },
          { value: 50, color: "#66bb6a" },
          { value: 100, color: "#ff0000" },
        ]}
        animate={true}
      />
    </div>
  );
};

export default SpeedMeterGauge;
