// 测试会话历史功能

// 模拟API响应数据
const mockHistoryResponse = {
  "code": 0,
  "msg": "success",
  "data": {
    "sessionInfo": {
      "sessionId": "69f0b622-8c0e-4276-aa72-e8b6df077483",
      "status": "active",
      "createTime": "2026-08-24 02:12:28"
    },
    "messageList": [
      {
        "userContent": "你好呀",
        "agentContent": null,
        "createTime": "2026-08-24 02:12:28"
      },
      {
        "userContent": null,
        "agentContent": "你好！很高兴见到你！我是你的智能助手，可以帮你查询天气、进行数学计算等。有什么我可以帮助你的吗？\n\n【消耗335个token】",
        "createTime": "2026-08-24 02:12:36"
      },
      {
        "userContent": "上海天气",
        "agentContent": null,
        "createTime": "2026-08-24 02:12:58"
      },
      {
        "userContent": null,
        "agentContent": "⚠️ Failed to fetch",
        "createTime": "2026-08-24 02:13:00"
      },
      {
        "userContent": "继续聊天吗",
        "agentContent": null,
        "createTime": "2026-08-24 02:14:30"
      },
      {
        "userContent": null,
        "agentContent": "当然可以继续聊天！我是您的AI助手，很高兴为您提供帮助。请问您需要什么协助呢？比如查询天气、进行数学计算，或者有其他问题都可以随时告诉我。\n\n【消耗346个token】",
        "createTime": "2026-08-24 02:14:31"
      }
    ]
  }
};

// 测试会话状态检查逻辑
const testSessionStatus = (status) => {
  console.log(`测试会话状态: ${status}`);
  console.log(`是否允许发送消息: ${status !== 'closed'}`);
  console.log(`会话状态标签: ${status === 'active' ? '进行中' : status === 'closed' ? '已结束' : status || '未知'}`);
};

// 测试消息转换逻辑
const testMessageConversion = (historyData) => {
  console.log('测试消息转换逻辑:');
  
  const userId = 'user-123';
  const botId = 'u-bot';
  const sessionId = historyData.data.sessionInfo.sessionId;
  
  const convertedMessages = [];
  
  historyData.data.messageList.forEach((msg, index) => {
    // 用户消息
    if (msg.userContent) {
      convertedMessages.push({
        id: `m-history-${sessionId}-user-${index}`,
        conversationId: sessionId,
        senderId: userId,
        content: msg.userContent,
        timestamp: msg.createTime
      });
    }
    
    // 代理消息
    if (msg.agentContent) {
      convertedMessages.push({
        id: `m-history-${sessionId}-agent-${index}`,
        conversationId: sessionId,
        senderId: botId,
        content: msg.agentContent,
        timestamp: msg.createTime
      });
    }
  });
  
  // 按时间排序
  convertedMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  console.log(`转换后消息数量: ${convertedMessages.length}`);
  console.log('消息列表:');
  convertedMessages.forEach((msg, i) => {
    console.log(`${i + 1}. [${msg.senderId === userId ? '用户' : 'AI'}] ${msg.content.substring(0, 30)}...`);
  });
  
  return convertedMessages;
};

// 执行测试
console.log('=== 会话历史功能测试 ===\n');

console.log('1. 测试会话状态检查');
testSessionStatus('active');
testSessionStatus('closed');
testSessionStatus('unknown');

console.log('\n2. 测试消息转换逻辑');
const messages = testMessageConversion(mockHistoryResponse);

console.log('\n3. 测试发送框禁用逻辑');
const scenarios = [
  { name: '未登录', locked: true, sessionClosed: false, loadingHistory: false, expected: true },
  { name: '加载历史中', locked: false, sessionClosed: false, loadingHistory: true, expected: true },
  { name: '会话已结束', locked: false, sessionClosed: true, loadingHistory: false, expected: true },
  { name: '正常状态', locked: false, sessionClosed: false, loadingHistory: false, expected: false },
];

scenarios.forEach(scenario => {
  const isLocked = scenario.locked || scenario.loadingHistory || scenario.sessionClosed;
  console.log(`${scenario.name}: ${isLocked === scenario.expected ? '✓' : '✗'} (预期: ${scenario.expected ? '禁用' : '启用'}, 实际: ${isLocked ? '禁用' : '启用'})`);
});

console.log('\n=== 测试完成 ===');