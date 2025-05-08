class Cache {
  constructor() {
    this.data = {};
  }
  
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    
    if (item.expiry && item.expiry < Date.now()) {
      delete this.data[key];
      return null;
    }
    
    return item.value;
  }
  
  set(key, value, ttlInSeconds = 3600) {
    this.data[key] = {
      value,
      expiry: ttlInSeconds ? Date.now() + (ttlInSeconds * 1000) : null
    };
  }
  
  clear(key) {
    if (key) {
      delete this.data[key];
    } else {
      this.data = {};
    }
  }
}

export default Cache; 