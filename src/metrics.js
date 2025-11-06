const config = require('./config.js').metrics;

const os = require('os');

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

// Metrics stored in memory
const requests = {};
let totalRequests = 0;
let activeUsers = 0;
let authenticationAttempts = {};
let numPizzasOrdered = 0;
let pizzaRevenue = 0;
let failedOrderAttempts = 0;
let latencyMeasurements = [];
let lastLatency = 0;
let requestLatencies = [];
let lastRequestLatency = 0;

// Middleware to track requests
function requestTracker(req, res, next) {
  const startTime = Date.now();
  
  const method = `${req.method}`;
  requests[method] = (requests[method] || 0) + 1;
  totalRequests++;
  
  // Track request latency when response finishes
  res.on('finish', () => {
    const latency = Date.now() - startTime;
    requestLatencies.push(latency);
    lastRequestLatency = latency;
  });
  
  next();
}

function incrementActiveUsers() {
  activeUsers++;
}

function decrementActiveUsers() {
  activeUsers = Math.max(0, activeUsers - 1);
}

function incrementSuccessfulAuthentications() {
    authenticationAttempts['successful'] = (authenticationAttempts['successful'] || 0) + 1;
}

function incrementFailedAuthentications() {
    authenticationAttempts['failed'] = (authenticationAttempts['failed'] || 0) + 1;
}

function handlePizzaMetrics(order) {
    numPizzasOrdered += order.items.length;
    pizzaRevenue += order.items.reduce((sum, item) => sum + item.price, 0);
}

function incrementFailedOrderAttempts() {
    failedOrderAttempts++;
}

function observeFactoryLatency(latency) {
  latencyMeasurements.push(latency);
  lastLatency = latency;
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const metrics = [];
  Object.keys(requests).forEach((method) => {
      metrics.push(createMetric('requests', requests[method], '1', 'sum', 'asInt', { method }));
  });
    
  metrics.push(createMetric('totalRequests', totalRequests, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('pizzasOrdered', numPizzasOrdered, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('pizzaRevenue', pizzaRevenue, 'USD', 'sum', 'asDouble', {}));
  metrics.push(createMetric('memoryUsage', getMemoryUsagePercentage(), 'percent', 'gauge', 'asDouble', {}));
  metrics.push(createMetric('cpuUsage', getCpuUsagePercentage(), 'percent', 'gauge', 'asDouble', {}));
  metrics.push(createMetric('activeUsers', activeUsers, '1', 'gauge', 'asInt', {}));
  metrics.push(createMetric('failedOrderAttempts', failedOrderAttempts, '1', 'sum', 'asInt', {}));
  metrics.push(createMetric('authenticationAttempts', authenticationAttempts['successful'] || 0, '1', 'sum', 'asInt', { status: 'successful' }));
  metrics.push(createMetric('authenticationAttempts', authenticationAttempts['failed'] || 0, '1', 'sum', 'asInt', { status: 'failed' }));
  
  // Send individual factory latency measurement (last recorded)
  if (lastLatency > 0) {
    metrics.push(createMetric('factoryLatency', lastLatency, 'ms', 'gauge', 'asInt', {}));
  }
  
  // Send average factory latency measurement
  if (latencyMeasurements.length > 0) {
    const avgLatency = latencyMeasurements.reduce((sum, val) => sum + val, 0) / latencyMeasurements.length;
    metrics.push(createMetric('factoryLatencyAvg', avgLatency, 'ms', 'gauge', 'asDouble', {}));
    latencyMeasurements = [];
  }
  
  // Send individual request latency measurement (last recorded)
  if (lastRequestLatency > 0) {
    metrics.push(createMetric('requestLatency', lastRequestLatency, 'ms', 'gauge', 'asInt', {}));
  }
  
  // Send average request latency measurement
  if (requestLatencies.length > 0) {
    const avgRequestLatency = requestLatencies.reduce((sum, val) => sum + val, 0) / requestLatencies.length;
    metrics.push(createMetric('requestLatencyAvg', avgRequestLatency, 'ms', 'gauge', 'asDouble', {}));
    requestLatencies = [];
  }
  
  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { requestTracker, incrementActiveUsers, decrementActiveUsers, incrementSuccessfulAuthentications, incrementFailedAuthentications, handlePizzaMetrics, incrementFailedOrderAttempts, observeFactoryLatency };