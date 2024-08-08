import React, { useEffect, useState } from "react";
import "./Main.css";
import SpeedTest from "../Components/SpeedTest/SpeedTest";

const Main = () => {
  const [status, setStatus] = useState(
    "Please wait while fetching network details ..."
  );
  const [networs, setNetworks] = useState([]);
  const [networkResult, setNetworkResult] = useState([]);
  const [currentResult, setCurrentResult] = useState();
  const [download, setDownload] = useState("");
  const [upload, setUpload] = useState(0);
  const [error, setError] = useState(0);
  const [selectedNetworks, setSelectedNetworks] = useState({});
  const [openNetworks, setOpenNetworks] = useState(false);

  const ipcRenderer = window.ipcRenderer;
  const firstRun = true;
  useEffect(() => {
    if (firstRun) {
      const resetState = () => {
        setUpload(0);
        setDownload(0);
        setCurrentResult(undefined);
      };

      resetState();

      getSpeed();

      const eventHandlers = {
        "wwan-networks": (event, networks) => {
          console.log("Networks:", event, networks);
          if (!event || event.length === 0) {
            setStatus("No network available");
          } else {
            setNetworks(event);
            setStatus("Select network and save configuration");
            // Update your UI with the networks list
          }
        },

        "wifi-networks-error": (event, error) => {
          console.log("Error:", event);
          setError("WiFi network error: " + event);
        },

        "speed-progress": (event, progress) => {
          if (event.type === "download") setDownload(event.speed);
          if (event.type === "upload") setUpload(event.speed);
        },

        "speed-result": (event, result) => {
          setCurrentResult(event);
          setNetworkResult((data) => {
            const existingNetwork = data.find(
              (network) =>
                !network.error &&
                network.download.bandwidth === event.download.bandwidth
            );
            if (!existingNetwork) {
              return [...data, event];
            } else {
              return data;
            }
          });
        },

        "speed-error": (event, result) => {
          setNetworkResult((prevData) => {
            const errorExists = prevData.some((item) => item?.error === event);
            return errorExists ? prevData : [...prevData, { error: event }];
          });
          setError("" + event);
          console.log(event, result);
        },

        reset: resetState,

        "set-status": (event, progress) => {
          setError("");
          setStatus(event);
        },
      };

      // Set up event listeners
      Object.entries(eventHandlers).forEach(([channel, handler]) => {
        ipcRenderer.on(channel, handler);
      });

      // Cleanup function
      return () => {
        Object.keys(eventHandlers).forEach((channel) => {
          ipcRenderer.removeListener(channel, eventHandlers[channel]);
        });
      };
    }
    firstRun = false;
  }, []);

  const scanNetworks = () => {
    const defaultNetworks = localStorage.getItem("ns-default-networks");
    const parsedNetworks = defaultNetworks ? JSON.parse(defaultNetworks) : [];
    console.log("defaultNetworks", parsedNetworks);
    setSelectedNetworks(parsedNetworks);
    setStatus("Please wait while fetching network details");
    setError("");
    setCurrentResult();
    setNetworkResult([]);
    setUpload(0);
    setDownload(0);
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.send("get-wwan-networks");
    } else {
      console.log("Ipc null");
    }
  };

  const getSpeed = async () => {
    setError("");
    setNetworkResult([]);
    const defaultNetworks = localStorage.getItem("ns-default-networks");
    const parsedNetworks = defaultNetworks
      ? JSON.parse(defaultNetworks)
      : undefined;
    if (parsedNetworks !== undefined) {
      console.log("parsedNetworks", parsedNetworks);
      await ipcRenderer.send("connect-to-network", parsedNetworks);
    } else {
      console.log("parsedNetworks not", parsedNetworks);
      setStatus("Error: Default configuartion not set");
    }
  };

  const handleNetworkChange = (event) => {
    const networkId = event.target.value;
    const isChecked = event.target.checked;
    setSelectedNetworks((prevNetworks) => {
      const updatedNetworks = { ...prevNetworks };
      if (isChecked) {
        updatedNetworks[networkId] = true;
      } else {
        delete updatedNetworks[networkId];
      }
      return updatedNetworks;
    });
  };

  const saveDefaults = () => {
    localStorage.setItem(
      "ns-default-networks",
      JSON.stringify(selectedNetworks)
    );
    setStatus("Default netowork configuration is Set");
    setOpenNetworks(false);
  };

  return (
    <div className="main-comp">
      <div className="title">Network Selector</div>
      <div className={`networks ${openNetworks && "open"} `}>
        <div className="network-list-container">
          <div className="network-list">
            {networs?.map((network) => (
              <div className="network-item" key={network}>
                <input
                  type="checkbox"
                  id={`network-${network}`}
                  value={network}
                  onChange={handleNetworkChange}
                  checked={!!selectedNetworks[network]}
                />
                <label htmlFor={`network-${network}`}>
                  {network || "Unnamed Network"}
                </label>
              </div>
            ))}
          </div>
          <div>
            <button className="test-button" onClick={saveDefaults}>
              Save
            </button>
            <button className="test-button" onClick={scanNetworks}>
              Refresh
            </button>
          </div>
        </div>
      </div>
      <div className={`button-div ${openNetworks ? "close" : "open"}`}>
        <button className="test-button" onClick={getSpeed}>
          Test & Connect
        </button>
        <button
          className="test-button"
          onClick={() => {
            scanNetworks();
            setOpenNetworks(true);
          }}
        >
          Set Default Networks
        </button>
      </div>
      {error ? (
        <div className="status error">{error}</div>
      ) : (
        <div className="status">{status}</div>
      )}
      <div className="speedtest-gauge-comp">
        <div className="gauge-container">
          <SpeedTest title={"Download Speed"} speed={download} />
          <SpeedTest
            title={"Upload Speed"}
            speed={isNaN(upload) ? 0 : upload}
          />
        </div>
        <div className="speed-data-container">
          <div className="speed-data">
            <div className="sd-comp">
              <div className="sd-c-title">Download Speed</div>
              {download ? (
                <div className="sd-c-count"> {download} Mb/s</div>
              ) : (
                <div className="sd-c-count">--</div>
              )}
            </div>
            <div className="sd-comp">
              <div className="sd-c-title">Upload Speed</div>
              {upload && !isNaN(upload) ? (
                <div className="sd-c-count"> {upload} Mb/s</div>
              ) : (
                <div className="sd-c-count">--</div>
              )}
            </div>
            <div className="sd-comp">
              <div className="sd-c-title">Latency</div>
              {currentResult ? (
                <div className="sd-c-count">
                  {currentResult?.ping.latency} ms
                </div>
              ) : (
                <div className="sd-c-count">--</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="net-group">
        {networkResult.map((data) => (
          <div className="network-status" key={data?.ssid}>
            {data.error ? (
              <div className="network-group">
                {/* <div className="ng-c-title">Error</div> */}
                <div className="ng-c-count">{data.error}</div>
              </div>
            ) : (
              <>
                <div className="ng-title">Network: {data?.ssid}</div>
                <div className="network-group">
                  <div className="ng-c-title">Download Speed</div>
                  <div className="ng-c-count">
                    {data?.download.bandwidth} Mb/s
                  </div>
                </div>
                <div className="network-group">
                  <div className="ng-c-title">Upload Speed</div>
                  <div className="ng-c-count">
                    {data?.upload.bandwidth} Mb/s
                  </div>
                </div>
                <div className="network-group">
                  <div className="ng-c-title">Latency</div>
                  <div className="ng-c-count">{data?.ping.latency} ms</div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Main;
