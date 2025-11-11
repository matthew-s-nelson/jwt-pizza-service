const config = require('./config.js').logging;

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  dbLogger = (query, params) => {
    query = this.fillSqlParams(query, params);
    let logData = {
        authorized: null,
        path: null,
        method: null,
        statusCode: null,
        reqBody: query,
        resBody: null,
    };
    this.log('info', 'db query', logData);
  };


  fillSqlParams(sql, params) {
    if (!params || params.length === 0) {
      return sql;
    }

    let filledSql = sql;
    let paramIndex = 0;

    filledSql = filledSql.replace(/\?/g, () => {
      if (paramIndex >= params.length) {
        return '?';
      }
      
      const param = params[paramIndex++];
      
      const isPassword = sql.toLowerCase().includes('password') && 
                         typeof param === 'string' && 
                         param.length > 10;

      if (isPassword) {
        return "'*******'";
      }
      
      // Format the parameter based on its type
      if (param === null) {
        return 'NULL';
      } else if (typeof param === 'string') {
        // Escape single quotes and wrap in quotes
        return `'${param.replace(/'/g, "''")}'`;
      } else if (typeof param === 'number') {
        return param.toString();
      } else if (typeof param === 'boolean') {
        return param ? '1' : '0';
      } else if (param instanceof Date) {
        return `'${param.toISOString()}'`;
      } else {
        return `'${String(param)}'`;
      }
    });

    return filledSql;
  }

  logFactoryRequest(statusCode, reqBody, resBody) {
    const logData = {
        authorized: null,
        path: '/api/order',
        method: 'POST',
        statusCode: statusCode,
        reqBody: reqBody,
        resBody: resBody,
    };
    this.log(statusCode === 200 ? 'info' : 'error', 'factory request', logData);
  }

  logUnhandledError(statusCode, errMessage, stacktrace) {
    const logData = {
        authorized: null,
        path: stacktrace,
        method: null,
        statusCode: statusCode,
        reqBody: null,
        resBody: { message: errMessage },
    };
    this.log('error', 'unhandled error', logData);
  }

  log(level, type, logData) {
    const labels = { component: config.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.userId}:${config.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}
module.exports = new Logger();