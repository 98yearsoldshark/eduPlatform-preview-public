// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../../config/runtime');
/**
 * 豆包AI服务 - 用于题目评分
 * 基于豆包API实现对题目的质量评分
 */
const axios = require('axios');

// 豆包API配置
const DOUBA_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'; // 豆包API地址
const DOUBA_API_KEY = process.env.DOUBA_API_KEY || ''; // 从环境变量获取API密钥

/**
 *     // 使用AI服务检测敏感内容
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: 'doubao-1-5-lite-32k-250115',
        messages: [
          {
            role: 'user',
            content: `请检查以下内容是否包含敏感词汇、不良信息或违规内容。如果包含，请回复"SENSITIVE"，否则回复"SAFE"。内容：${content}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DOUBA_API_KEY || ''}`,
          'Content-Type': 'application/json'
        }
      }
    );
 * 使用豆包AI评估题目质量
 * @param {Object} prompt - 评估提示
 * @returns {Promise<Object>} - 评分结果，包含分数和理由
 */
async function evaluateQuestion(prompt) {
  try {
    console.log('正在发送AI评分请求...');
    
    // 检查API密钥
    if (!DOUBA_API_KEY) {
      console.warn('未设置豆包API密钥，使用模拟评分');
      return mockEvaluation(prompt);
    }
    
    
    // 构建请求体
    const requestBody = {
      model: 'doubao-1-5-lite-32k-250115', // 使用豆包模型
      messages: [
        {
          role: 'system',
          content: '你是一位教育专家，负责评估数学和物理题目的质量。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // 较低的温度以获得更一致的结果
      max_tokens: 200
    };
    
    // 发送请求到豆包API
    const response = await axios.post(DOUBA_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBA_API_KEY}`
      }
    });
    
    // 解析响应
    const aiResponse = response.data.choices[0].message.content;
    console.log('AI原始响应:', aiResponse);
    
    // 尝试提取JSON格式的评分
    let result;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有找到JSON，尝试提取分数和理由
        const scoreMatch = aiResponse.match(/score["']?\s*:?\s*(\d+)/i);
        const reasonMatch = aiResponse.match(/reason["']?\s*:?\s*["']([^"']+)["']/i);
        
        result = {
          score: scoreMatch ? parseInt(scoreMatch[1]) : 10,
          reason: reasonMatch ? reasonMatch[1] : '未找到明确评分理由'
        };
      }
    } catch (error) {
      console.error('解析AI响应出错:', error);
      // 提取数字作为分数
      const scoreMatch = aiResponse.match(/(\d+)[\s\/]20/);
      result = {
        score: scoreMatch ? parseInt(scoreMatch[1]) : 10,
        reason: '无法解析AI响应，使用默认评分'
      };
    }
    
    // 确保分数在1-20范围内
    result.score = Math.max(1, Math.min(20, result.score || 10));
    
    console.log('处理后的评分结果:', result);
    return result;
  } catch (error) {
    console.error('AI评估出错:', error);
    return {
      score: 10, // 出错时默认给10分
      reason: `AI评估请求失败: ${error.message || '未知错误'}`
    };
  }
}

/**
 * 模拟评分（当API密钥未设置时使用）
 * @param {string} prompt - 评估提示
 * @returns {Object} - 模拟的评分结果
 */
function mockEvaluation(prompt) {
  console.log('使用模拟评分...');
  
  // 根据提示内容生成一个伪随机分数
  const promptText = JSON.stringify(prompt);
  let score = 10; // 默认中等分数
  
  // 根据提示中的一些关键词调整分数
  if (promptText.includes('评论') && promptText.match(/评论.{0,20}多/)) {
    score += 2; // 评论多，加分
  }
  
  if (promptText.includes('点赞') && promptText.match(/点赞.{0,20}多/)) {
    score += 1; // 点赞多，加分
  }
  
  if (promptText.includes('收藏') && promptText.match(/收藏.{0,20}多/)) {
    score += 1; // 收藏多，加分
  }
  
  // 确保分数在1-20范围内
  score = Math.max(1, Math.min(20, score));
  
  return {
    score,
    reason: '这是一个模拟评分，基于题目的引用次数和互动情况。真实评分需要配置豆包API密钥。'
  };
}

module.exports = {
  evaluateQuestion
}; 