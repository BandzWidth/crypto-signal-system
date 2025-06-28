const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class SystemMonitor {
  constructor() {
    this.config = {
      checkInterval: 60000, // 1 minute
      healthEndpoint: '/api/assets',
      logFile: path.join(__dirname, 'logs', 'monitoring.log'),
      alertThreshold: 3 // Number of failed checks before alert
    };
    
    this.failedChecks = 0;
    this.lastCheck = null;
    this.isRunning = false;
  }

  async checkHealth(url = 'http://localhost:3000') {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(`${url}${this.config.healthEndpoint}`, (res) => {
        const isHealthy = res.statusCode === 200;
        this.log(`Health check: ${isHealthy ? 'PASSED' : 'FAILED'} (${res.statusCode})`);
        resolve(isHealthy);
      });

      req.on('error', (error) => {
        this.log(`Health check ERROR: ${error.message}`);
        resolve(false);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        this.log('Health check TIMEOUT');
        resolve(false);
      });
    });
  }

  async checkSystemResources() {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;
    
    const cpuLoad = os.loadavg()[0]; // 1 minute average
    
    this.log(`System Resources - Memory: ${memoryUsage.toFixed(1)}%, CPU Load: ${cpuLoad.toFixed(2)}`);
    
    return {
      memoryUsage,
      cpuLoad,
      isHealthy: memoryUsage < 90 && cpuLoad < 5
    };
  }

  async checkDiskSpace() {
    const fs = require('fs').promises;
    try {
      const stats = await fs.statfs('.');
      const totalSpace = stats.blocks * stats.bsize;
      const freeSpace = stats.bavail * stats.bsize;
      const usedSpace = totalSpace - freeSpace;
      const diskUsage = (usedSpace / totalSpace) * 100;
      
      this.log(`Disk Usage: ${diskUsage.toFixed(1)}%`);
      return { diskUsage, isHealthy: diskUsage < 90 };
    } catch (error) {
      this.log(`Disk check ERROR: ${error.message}`);
      return { diskUsage: 0, isHealthy: false };
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage);
    
    // Ensure logs directory exists
    const logDir = path.dirname(this.config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Append to log file
    fs.appendFileSync(this.config.logFile, logMessage + '\n');
  }

  async sendAlert(message) {
    this.log(`ALERT: ${message}`);
    // Here you could integrate with notification services like:
    // - Email (nodemailer)
    // - Slack webhook
    // - Discord webhook
    // - SMS (Twilio)
    // - Push notifications
  }

  async performFullCheck(url) {
    this.lastCheck = new Date();
    
    // Health check
    const isHealthy = await this.checkHealth(url);
    
    // System resources check
    const resources = await this.checkSystemResources();
    
    // Disk space check
    const disk = await this.checkDiskSpace();
    
    // Overall system health
    const overallHealthy = isHealthy && resources.isHealthy && disk.isHealthy;
    
    if (!overallHealthy) {
      this.failedChecks++;
      this.log(`System check FAILED (${this.failedChecks}/${this.config.alertThreshold})`);
      
      if (this.failedChecks >= this.config.alertThreshold) {
        await this.sendAlert(`Trading Signal System is unhealthy after ${this.failedChecks} failed checks`);
      }
    } else {
      if (this.failedChecks > 0) {
        this.log('System recovered - clearing failed check counter');
        this.failedChecks = 0;
      }
    }
    
    return {
      timestamp: this.lastCheck,
      healthy: overallHealthy,
      health: isHealthy,
      resources,
      disk,
      failedChecks: this.failedChecks
    };
  }

  start(url = 'http://localhost:3000') {
    if (this.isRunning) {
      this.log('Monitor is already running');
      return;
    }
    
    this.isRunning = true;
    this.log('Starting system monitor...');
    
    // Perform initial check
    this.performFullCheck(url);
    
    // Set up periodic checks
    this.interval = setInterval(() => {
      this.performFullCheck(url);
    }, this.config.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.log('System monitor stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      failedChecks: this.failedChecks,
      config: this.config
    };
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new SystemMonitor();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  const url = args[0] || 'http://localhost:3000';
  
  console.log(`Starting monitor for: ${url}`);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
  
  // Start monitoring
  monitor.start(url);
}

module.exports = SystemMonitor; 