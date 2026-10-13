/**
 * AI路由 - 处理AI相关请求
 */
const express = require('express');
const router = express.Router();
const { evaluateQuestion } = require('../services/ai/doubaAIService');
const { executeWithRetry } = require('../server'); // 导入数据库操作函数

/**
 * @route POST /api/ai/evaluate
 * @desc 使用AI评估题目质量
 * @access Public
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    // 验证请求
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        message: '请求缺少必要的prompt参数' 
      });
    }
    
    // 调用AI服务评估题目
    console.log('收到AI评分请求');
    const result = await evaluateQuestion(prompt);
    
    // 返回评估结果
    res.json({
      success: true,
      score: result.score,
      reason: result.reason
    });
  } catch (error) {
    console.error('AI评估处理出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '处理AI评估请求时出错',
      error: error.message || '未知错误'
    });
  }
});

/**
 * @route POST /api/ai/save-score
 * @desc 保存题目的综合评分结果
 * @access Public
 */
router.post('/save-score', async (req, res) => {
  try {
    const { 
      questionId, 
      questionType, 
      teacherId,
      statisticsScore,  // 统计数据评分(80分)
      aiScore,          // AI评分(20分)
      totalScore,       // 总评分(100分)
      aiEvaluation      // AI评价内容
    } = req.body;
    
    // 验证请求参数
    if (!questionId || !questionType || !totalScore) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    console.log(`保存题目评分数据: ID=${questionId}, 类型=${questionType}, 总分=${totalScore}`);
    
    // 使用事务确保数据一致性
    const result = await executeWithRetry(async (connection) => {
      // 检查该题目在teachers_selected_questions表中是否已存在记录
      const [existingRecord] = await connection.query(
        `SELECT id FROM teachers_selected_questions 
         WHERE question_id = ? AND question_type = ?
         ${teacherId ? ' AND teacher_id = ?' : ''}`,
        teacherId ? [questionId, questionType, teacherId] : [questionId, questionType]
      );
      
      if (existingRecord.length > 0) {
        // 更新现有记录
        const recordId = existingRecord[0].id;
        await connection.query(
          `UPDATE teachers_selected_questions 
           SET ai_score = ?, 
               ai_evaluation = ?, 
               total_score = ?, 
               score_updated_at = NOW()
           WHERE id = ?`,
          [aiScore, aiEvaluation, totalScore, recordId]
        );
        
        console.log(`更新题目评分记录: ID=${recordId}, 新总分=${totalScore}`);
        return { success: true, message: '评分数据已更新', recordId };
      } else {
        // 确定教师ID
        let targetTeacherId = teacherId;
        if (!targetTeacherId) {
          const [defaultTeacher] = await connection.query(`SELECT id FROM teachers LIMIT 1`);
          targetTeacherId = defaultTeacher.length > 0 ? defaultTeacher[0].id : 1;
        }
        
        // 创建新记录
        const [insertResult] = await connection.query(
          `INSERT INTO teachers_selected_questions 
           (teacher_id, question_id, question_type, ai_score, ai_evaluation, 
            total_score, score_updated_at, question_folder_or_id)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
          [targetTeacherId, questionId, questionType, aiScore, aiEvaluation, 
           totalScore, questionId.toString()]
        );
        
        console.log(`创建题目评分记录: ID=${insertResult.insertId}, 总分=${totalScore}`);
        return { success: true, message: '评分数据已保存', recordId: insertResult.insertId };
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('保存评分数据失败:', error);
    res.status(500).json({
      success: false,
      message: '保存评分数据失败',
      error: error.message || '未知错误'
    });
  }
});

module.exports = router; 