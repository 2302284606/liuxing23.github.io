// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 更新UI显示
function updateUI(params) {
    console.log('开始更新UI, 参数:', params);
    
    if (params.temperature !== undefined) {
        console.log('更新温度:', params.temperature);
        document.getElementById('temperature').textContent = params.temperature + '°C';
    }
    if (params.humidity !== undefined) {
        console.log('更新湿度:', params.humidity);
        document.getElementById('humidity').textContent = params.humidity + '%';
    }
    if (params.led !== undefined) {
        console.log('更新LED状态:', params.led);
        document.getElementById('ledSwitch').checked = params.led;
    }
    if (params.fan_switch !== undefined) {
        console.log('更新风扇开关:', params.fan_switch);
        document.getElementById('fanSwitch').checked = params.fan_switch;
    }
    if (params.fan_speed !== undefined) {
        console.log('更新风扇速度:', params.fan_speed);
        const speedSelect = document.getElementById('fanSpeed');
        speedSelect.value = params.fan_speed.toString();
        console.log('设置后的风扇速度值:', speedSelect.value);
    }
}

// 更新连接状态显示
function updateConnectionStatus(status, message = '') {
    const statusElement = document.getElementById('connectionStatus');
    const statusTextElement = document.getElementById('statusText');
    
    console.log('更新状态:', status, message);
    
    switch(status) {
        case 'online':
            statusElement.className = 'status-connected';
            statusTextElement.textContent = message || '在线';
            break;
        case 'error':
            statusElement.className = 'status-disconnected';
            statusTextElement.textContent = message || '错误';
            break;
        case 'loading':
            statusElement.className = 'status-loading';
            statusTextElement.textContent = message || '加载中...';
            break;
        default:
            statusElement.className = 'status-disconnected';
            statusTextElement.textContent = message || '离线';
    }
}

// 通过MQTT发送控制命令
function sendMQTTControl(type, value) {
    try {
        if (!mqttClient || !mqttClient.connected) {
            throw new Error('MQTT未连接');
        }

        console.log('发送MQTT控制命令:', type, value);
        const message = {
            type: type,
            value: value,
            timestamp: Date.now()
        };

        mqttClient.publish('liuxing23i/fan/control', JSON.stringify(message), { qos: 1 }, (error) => {
            if (error) {
                console.error('发送控制命令失败:', error);
                updateConnectionStatus('error', '发送失败');
            } else {
                console.log('控制命令发送成功');
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });
    } catch (error) {
        console.error('发送控制命令失败:', error);
        updateConnectionStatus('error', error.message);
    }
}

// 发送风扇控制命令
function sendFanControl(type, value) {
    try {
        if (!mqttClient || !mqttClient.connected) {
            throw new Error('MQTT未连接');
        }

        console.log('发送风扇控制命令:', type, value);
        const message = {
            type: type,
            value: value,
            timestamp: Date.now()
        };

        mqttClient.publish('liuxing23i/fan/control', JSON.stringify(message), { qos: 1 }, (error) => {
            if (error) {
                console.error('发送控制命令失败:', error);
                updateConnectionStatus('error', '发送失败');
            } else {
                console.log('控制命令发送成功');
                // 添加触觉反馈
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });
    } catch (error) {
        console.error('发送控制命令失败:', error);
        updateConnectionStatus('error', error.message);
    }
}

// 绑定UI事件
document.getElementById('ledSwitch').addEventListener('change', function(e) {
    sendMQTTControl('led', e.target.checked);
});

document.getElementById('fanSwitch').addEventListener('change', function(e) {
    sendFanControl('fan_switch', e.target.checked);
});

document.getElementById('fanSpeed').addEventListener('change', function(e) {
    const value = parseInt(e.target.value);
    sendFanControl('fan_speed', value);
});

// 绑定风扇控制UI事件
document.getElementById('fanSwitch').addEventListener('change', function(e) {
    sendFanControl('fan_switch', e.target.checked);
});

document.getElementById('fanSpeed').addEventListener('change', function(e) {
    const value = parseInt(e.target.value);
    sendFanControl('fan_speed', value);
});

// 添加触摸反馈
document.querySelectorAll('.form-check-input, .form-select').forEach(element => {
    element.addEventListener('touchstart', function() {
        this.style.opacity = '0.7';
    });
    element.addEventListener('touchend', function() {
        this.style.opacity = '1';
    });
});

// 连接MQTT服务器
async function connectMQTT() {
    try {
        console.log('开始连接MQTT服务器...');
        updateConnectionStatus('loading', '正在连接MQTT服务器...');

        // 构建WebSocket URL
        const wsUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`;
        
        // 连接选项
        const options = {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            clean: true,
            rejectUnauthorized: false,
            reconnectPeriod: 5000,
        };

        // 创建MQTT客户端连接
        mqttClient = mqtt.connect(wsUrl, options);

        // 监听连接事件
        mqttClient.on('connect', () => {
            console.log('MQTT连接成功');
            updateConnectionStatus('online', 'MQTT已连接');
            subscribeToTopics();
        });

        // 监听错误事件
        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
            updateConnectionStatus('error', 'MQTT连接错误');
        });

        // 监听消息事件
        mqttClient.on('message', (topic, message) => {
            console.log('收到MQTT消息:', topic, message.toString());
            handleMQTTMessage(topic, message);
        });

        // 监听断开连接事件
        mqttClient.on('close', () => {
            console.log('MQTT连接已断开');
            updateConnectionStatus('error', 'MQTT已断开');
        });

    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateConnectionStatus('error', 'MQTT连接失败');
    }
}

// 订阅主题
function subscribeToTopics() {
    const topics = [
        'liuxing23i/fan',         // 状态订阅主题
        'liuxing23i/fan/control'  // 控制反馈主题
    ];

    topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (err) {
                console.error('订阅主题失败:', topic, err);
            } else {
                console.log('成功订阅主题:', topic);
            }
        });
    });
}

// 更新风扇状态显示
function updateFanStatus(status) {
    const fanSwitch = document.getElementById('fanSwitch');
    const fanSpeed = document.getElementById('fanSpeed');
    const fanSpeedValue = document.getElementById('fanSpeedValue');
    
    if (status.fan_switch !== undefined) {
        fanSwitch.checked = status.fan_switch;
        // 如果风扇关闭，禁用速度控制
        fanSpeed.disabled = !status.fan_switch;
    }
    
    if (status.fan_speed !== undefined) {
        fanSpeed.value = status.fan_speed;
        fanSpeedValue.textContent = status.fan_speed + '%';
    }
}

// 修改handleMQTTMessage函数，添加风扇状态处理
function handleMQTTMessage(topic, message) {
    try {
        const data = JSON.parse(message.toString());
        console.log('收到MQTT消息:', topic, data);
        
        if (topic === 'liuxing23i/fan') {
            // 更新温湿度显示
            if (data.temperature !== undefined) {
                document.getElementById('temperature').textContent = data.temperature + '°C';
            }
            if (data.humidity !== undefined) {
                document.getElementById('humidity').textContent = data.humidity + '%';
            }
            
            // 更新风扇状态
            updateFanStatus({
                fan_switch: data.fan_switch,
                fan_speed: data.fan_speed
            });
            
            // 更新LED状态
            if (data.led !== undefined) {
                document.getElementById('ledSwitch').checked = data.led;
            }
        }
    } catch (error) {
        console.error('处理MQTT消息失败:', error);
    }
}

// 添加风扇速度值显示更新
document.getElementById('fanSpeed').addEventListener('input', function(e) {
    document.getElementById('fanSpeedValue').textContent = e.target.value + '%';
});

// 初始化
console.log('开始初始化应用...');
connectMQTT(); 

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker 注册成功:', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker 注册失败:', error);
      });
  });
} 