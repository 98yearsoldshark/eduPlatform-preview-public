/**
 * 题目管理路由 - 题目列表相关功能
 */
const axios = require('axios');
const { executeWithRetry, generateQuestionId, handleFolderRecursively } = require('./questionUtils');

/**
 * 获取题目列表
 */
const getQuestionList = async (req, res) => {
  const { 
    teacherId, 
    subject, 
    year, 
    type,
    grade, 
    selectionStatus = 'all', 
    page = 1, 
    limit = 10,
    tab = 'all'
  } = req.query;
  
  if (!teacherId) {
    return res.status(400).json({ message: '缺少必要参数: teacherId' });
  }
  
  try {
    console.log(`获取题目列表请求, 教师ID: ${teacherId}, 筛选条件:`, req.query);
    
    // 查询所有题目的评分数据
    const allScoresData = await executeWithRetry(async (conn) => {
      const [rows] = await conn.query(
        `SELECT 
           question_id, 
           question_type,
           ai_score,
           ai_evaluation,
           total_score,
           score_updated_at
         FROM teachers_selected_questions`
      );
      return rows;
    });
    
    console.log(`查询到 ${allScoresData.length} 条题目评分数据`);
    
    // 构建所有题目的评分数据映射，每个题目ID只保留最高分记录
    const allScoresMap = new Map();
    allScoresData.forEach(q => {
      // 修改键值构造方式，确保能够正确匹配
      // 题目类型规范化为小写
      const qType = q.question_type.toLowerCase();
      const key = `${qType}-${q.question_id}`;
      
      // 确保评分数据是数值类型
      const totalScore = parseFloat(q.total_score) || 0;
      const aiScore = parseFloat(q.ai_score) || 0;
      
      // 如果已经存在这个键，只有当新数据的total_score大于现有数据时才更新
      if (allScoresMap.has(key)) {
        const existing = allScoresMap.get(key);
        if (totalScore > existing.total_score) {
          allScoresMap.set(key, {
            ai_score: aiScore,
            ai_evaluation: q.ai_evaluation || '',
            total_score: totalScore,
            score_updated_at: q.score_updated_at || null
          });
        }
      } else {
        allScoresMap.set(key, {
          ai_score: aiScore,
          ai_evaluation: q.ai_evaluation || '',
          total_score: totalScore,
          score_updated_at: q.score_updated_at || null
        });
      }
    });
    
    // 查询已选题目及其统计数据
    const selectedQuestions = await executeWithRetry(async (conn) => {
      const [rows] = await conn.query(
        `SELECT 
           question_id, 
           question_type, 
           question_folder_or_id,
           star_count AS starCount, 
           post_count AS postCount, 
           comment_count AS commentCount, 
           like_count AS likeCount,
           recommend_count AS recommendCount,
           coin_count AS coinCount,
           favorite_count AS favoriteCount,
           student_rating_total AS appleCount,
           student_rating_count AS studentCount,
           average_rating AS averageRating
         FROM teachers_selected_questions 
         WHERE teacher_id = ?`,
        [teacherId]
      );
      return rows;
    });
    
    // 构建已选题目ID映射
    const selectedMap = new Map();
    selectedQuestions.forEach(q => {
      const key = `${q.question_type}-${q.question_id}`;
      selectedMap.set(key, {
        folderOrId: q.question_folder_or_id,
        starCount: q.starCount || 0,
        postCount: q.postCount || 0,
        commentCount: q.commentCount || 0,
        likeCount: q.likeCount || 0,
        recommendCount: q.recommendCount || 0,
        coinCount: q.coinCount || 0,
        favoriteCount: q.favoriteCount || 0,
        appleCount: q.appleCount || 0,
        studentCount: q.studentCount || 0,
        averageRating: q.averageRating || 0
      });
    });
    
    // 构建API请求参数
    const latexParams = {};
    const imageParams = {};
    
    if (subject) {
      latexParams.subject = subject;
      imageParams.subject = subject;
    }
    if (year) {
      latexParams.year = year;
      imageParams.year = year;
    }
    if (type) {
      latexParams.type = type;
      imageParams.type = type;
    }
    if (grade) {
      latexParams.grade = grade;
      imageParams.grade = grade;
    }
    
    // 获取题目数据
    let latexQuestions = [];
    let imageQuestions = [];
    
    // 根据tab决定获取哪种类型的题目
    if (tab === 'all' || tab === 'latex') {
      // 获取LaTeX题目
      try {
        const latexResponse = await axios.get('http://localhost:3001/latex-questions', {
          params: latexParams
        });
        latexQuestions = Array.isArray(latexResponse.data) ? latexResponse.data : [];
        
        // 添加类型标记和选中状态以及评分数据
        latexQuestions = latexQuestions.map(q => {
          // 题目类型规范化为小写
          const qType = 'latex';
          const key = `${qType}-${q.id}`;
          const selectedData = selectedMap.get(key) || {};
          const scoreData = allScoresMap.get(key) || {};
          
          return {
            ...q,
            id: parseInt(q.id),
            type: 'latex',
            is_selected: selectedMap.has(key),
            // 添加统计数据
            starCount: selectedData.starCount || 0,
            postCount: selectedData.postCount || 0,
            commentCount: selectedData.commentCount || 0,
            likeCount: selectedData.likeCount || 0,
            recommendCount: selectedData.recommendCount || 0,
            coinCount: selectedData.coinCount || 0,
            favoriteCount: selectedData.favoriteCount || 0,
            appleCount: selectedData.appleCount || 0,
            studentCount: selectedData.studentCount || 0,
            averageRating: selectedData.averageRating || 0,
            // 添加评分数据 - 确保是数值类型
            ai_score: parseFloat(scoreData.ai_score) || 0,
            ai_evaluation: scoreData.ai_evaluation || '',
            total_score: parseFloat(scoreData.total_score) || 0,
            score_updated_at: scoreData.score_updated_at || null
          };
        });
      } catch (error) {
        console.error('获取LaTeX题目失败:', error);
      }
    }
    
    if (tab === 'all' || tab === 'image') {
      // 获取文件夹结构
      try {
        console.log('获取图片题目，参数:', imageParams);
        
        // 使用遍历方法获取所有题目，然后根据筛选条件过滤
        // 第一步：获取所有科目
        const allSubjectsResponse = await axios.get('http://localhost:3001/folders');
        let allSubjects = [];
        
        if (Array.isArray(allSubjectsResponse.data)) {
          allSubjects = allSubjectsResponse.data;
        } else if (allSubjectsResponse.data && Array.isArray(allSubjectsResponse.data.folders)) {
          allSubjects = allSubjectsResponse.data.folders;
        }
        
        console.log(`获取到 ${allSubjects.length} 个科目`);
        
        // 根据筛选条件过滤科目
        const subjectsToProcess = subject 
          ? allSubjects.filter(s => s.name === subject)
          : allSubjects;
          
        // 逐个处理每个科目
        for (const subjectFolder of subjectsToProcess) {
          // 获取科目下的年级
          const gradesResponse = await axios.get('http://localhost:3001/folders', {
            params: { subject: subjectFolder.name }
          });
          
          let grades = [];
          if (Array.isArray(gradesResponse.data)) {
            grades = gradesResponse.data;
          } else if (gradesResponse.data && Array.isArray(gradesResponse.data.folders)) {
            grades = gradesResponse.data.folders;
          }
          
          // 根据筛选条件过滤年级
          const gradesToProcess = grade 
            ? grades.filter(g => g.name === grade)
            : grades;
            
          console.log(`科目 ${subjectFolder.name} 下筛选后处理 ${gradesToProcess.length} 个年级`);
          
          // 逐个处理每个年级
          for (const gradeFolder of gradesToProcess) {
            // 获取年级下的年份
            const yearsResponse = await axios.get('http://localhost:3001/folders', {
              params: { 
                subject: subjectFolder.name,
                grade: gradeFolder.name 
              }
            });
            
            let years = [];
            if (Array.isArray(yearsResponse.data)) {
              years = yearsResponse.data;
            } else if (yearsResponse.data && Array.isArray(yearsResponse.data.folders)) {
              years = yearsResponse.data.folders;
            }
            
            // 根据筛选条件过滤年份
            const yearsToProcess = year 
              ? years.filter(y => y.name === year)
              : years;
              
            console.log(`年级 ${gradeFolder.name} 下筛选后处理 ${yearsToProcess.length} 个年份`);
            
            // 逐个处理每个年份
            for (const yearFolder of yearsToProcess) {
              // 获取年份下的题目类型
              const typesResponse = await axios.get('http://localhost:3001/folders', {
                params: { 
                  subject: subjectFolder.name,
                  grade: gradeFolder.name,
                  year: yearFolder.name 
                }
              });
              
              let types = [];
              if (Array.isArray(typesResponse.data)) {
                types = typesResponse.data;
              } else if (typesResponse.data && Array.isArray(typesResponse.data.folders)) {
                types = typesResponse.data.folders;
              }
              
              // 根据筛选条件过滤题目类型
              const typesToProcess = type 
                ? types.filter(t => t.name === type)
                : types;
                
              console.log(`年份 ${yearFolder.name} 下筛选后处理 ${typesToProcess.length} 个题目类型`);
              
              // 逐个处理每个题目类型
              for (const typeFolder of typesToProcess) {
                // 获取题目类型下的文件夹（具体题目）
                const questionsResponse = await axios.get('http://localhost:3001/folders', {
                  params: { 
                    subject: subjectFolder.name,
                    grade: gradeFolder.name,
                    year: yearFolder.name,
                    type: typeFolder.name 
                  }
                });
                
                let questions = [];
                if (Array.isArray(questionsResponse.data)) {
                  questions = questionsResponse.data;
                } else if (questionsResponse.data && Array.isArray(questionsResponse.data.folders)) {
                  questions = questionsResponse.data.folders;
                }
                
                console.log(`题目类型 ${typeFolder.name} 下有 ${questions.length} 个题目文件夹`);
                
                // 处理每个题目文件夹
                for (const questionFolder of questions) {
                  try {
                    // 构建完整路径
                    const folderPath = `${subjectFolder.name}/${gradeFolder.name}/${yearFolder.name}/${typeFolder.name}/${questionFolder.name}`;
                    
                    // 获取图片
                    const imageResponse = await axios.get('http://localhost:3001/images', {
                      params: { folderPath }
                    });
                    
                    if (imageResponse.data && imageResponse.data.length > 0) {
                      // 为每个文件夹创建一个题目对象
                      const questionId = generateQuestionId(questionFolder.name);
                      imageQuestions.push({
                        id: questionId,
                        type: 'image',
                        subject: subjectFolder.name,
                        grade: gradeFolder.name,
                        year: yearFolder.name,
                        question_type: typeFolder.name,
                        folder_name: questionFolder.name,
                        path: folderPath,
                        images: imageResponse.data,
                        is_selected: selectedMap.has(`image-${questionId}`)
                      });
                    }
                  } catch (questionError) {
                    console.error(`处理题目文件夹 ${questionFolder.name} 时出错:`, questionError);
                  }
                }
              }
            }
          }
        }
        
        console.log(`总共获取到 ${imageQuestions.length} 个图片题目`);
      } catch (folderError) {
        console.error('获取文件夹结构失败:', folderError);
      }
    }
    
    // 添加评分数据到图片题目
    const processedImageQuestions = imageQuestions.map(question => {
      const questionId = question.id || generateQuestionId(question.subject, question.grade, question.year, question.question_type, question.folder_name);
      // 题目类型规范化为小写
      const qType = 'image';
      const key = `${qType}-${questionId}`;
      const selectedData = selectedMap.get(key) || {};
      const scoreData = allScoresMap.get(key) || {};
      
      return {
        id: questionId,
        type: 'image',
        is_selected: selectedMap.has(key),
        subject: question.subject,
        grade: question.grade,
        year: question.year,
        question_type: question.question_type,
        folder_name: question.folder_name,
        path: question.path,
        images: question.images || [],
        // 添加统计数据
        starCount: selectedData.starCount || 0,
        postCount: selectedData.postCount || 0,
        commentCount: selectedData.commentCount || 0,
        likeCount: selectedData.likeCount || 0,
        recommendCount: selectedData.recommendCount || 0,
        coinCount: selectedData.coinCount || 0,
        favoriteCount: selectedData.favoriteCount || 0,
        appleCount: selectedData.appleCount || 0,
        studentCount: selectedData.studentCount || 0,
        averageRating: selectedData.averageRating || 0,
        // 添加评分数据 - 确保是数值类型
        ai_score: parseFloat(scoreData.ai_score) || 0,
        ai_evaluation: scoreData.ai_evaluation || '',
        total_score: parseFloat(scoreData.total_score) || 0,
        score_updated_at: scoreData.score_updated_at || null
      };
    });
    
    // 重新合并题目列表
    let allQuestions = [...latexQuestions, ...processedImageQuestions];
    
    // 在后端终端打印题目评分数据
    console.log('\n========== 题目评分数据 ==========');
    console.log('题号\t类型\t总评分\t更新时间');
    console.log('------------------------------------');
    allQuestions.forEach(q => {
      const updateTime = q.score_updated_at 
        ? new Date(q.score_updated_at).toLocaleString('zh-CN')
        : '未更新';
      console.log(`${q.id}\t${q.type}\t${q.total_score?.toFixed(1) || 0}\t${updateTime}`);
    });
    console.log('====================================\n');
    
    // 提取所有带评分的题目
    const questionsWithScores = allQuestions.filter(q => (q.total_score || 0) > 0);
    
    console.log(`过滤前的所有题目中有 ${questionsWithScores.length} 个有评分数据:`);
    questionsWithScores.forEach(q => {
      console.log(`ID: ${q.id}, 类型: ${q.type}, 总评分: ${q.total_score}`);
    });
    
    // 根据选中状态筛选
    if (selectionStatus === 'selected') {
      allQuestions = allQuestions.filter(q => q.is_selected);
    } else if (selectionStatus === 'unselected') {
      allQuestions = allQuestions.filter(q => !q.is_selected);
    }
    
    // 筛选后检查评分数据
    const filteredQuestionsWithScores = allQuestions.filter(q => (q.total_score || 0) > 0);
    
    console.log(`选中状态筛选后有 ${filteredQuestionsWithScores.length} 个题目有评分数据:`);
    filteredQuestionsWithScores.forEach(q => {
      console.log(`ID: ${q.id}, 类型: ${q.type}, 总评分: ${q.total_score}`);
    });
    
    // 分页处理
    const startIndex = (page - 1) * limit;
    const paginatedQuestions = allQuestions.slice(startIndex, startIndex + parseInt(limit));
    
    // 检查分页后的题目中有多少评分大于0的题目
    const paginatedQuestionsWithScores = paginatedQuestions.filter(q => (q.total_score || 0) > 0);
    console.log(`分页后有 ${paginatedQuestionsWithScores.length} 个题目评分大于0`);
    
    if (paginatedQuestionsWithScores.length > 0) {
      console.log('评分大于0的题目:');
      paginatedQuestionsWithScores.forEach(q => {
        console.log(`ID: ${q.id}, 类型: ${q.type}, 总评分: ${q.total_score}, 类型: ${typeof q.total_score}`);
      });
    }
    
    // 添加查询参数到响应，包含所有评分数据
    res.json({
      questions: paginatedQuestions,
      total: allQuestions.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(allQuestions.length / limit),
      // 添加所有评分数据，不受分页影响
      allScoresData: filteredQuestionsWithScores.map(q => {
        // 对于数据库中实际A卷题目，将question_type设置为"A卷"
        let questionType = q.question_type;
        if (!questionType && q.type === 'latex') {
          // 如果是LaTeX题目但没有question_type，设置一个默认值
          questionType = 'A卷';
        }
        
        // 创建包含完整内容的对象
        return {
          id: q.id,
          type: q.type,
          total_score: q.total_score,
          ai_score: q.ai_score,
          ai_evaluation: q.ai_evaluation,
          score_updated_at: q.score_updated_at,
          subject: q.subject,
          grade: q.grade,
          year: q.year,
          question_type: questionType,
          folder_name: q.folder_name || '', 
          path: q.path,
          starCount: q.starCount || 0,
          postCount: q.postCount || 0,
          commentCount: q.commentCount || 0,
          likeCount: q.likeCount || 0,
          recommendCount: q.recommendCount || 0,
          coinCount: q.coinCount || 0,
          favoriteCount: q.favoriteCount || 0,
          appleCount: q.appleCount || 0,
          studentCount: q.studentCount || 0,
          averageRating: q.averageRating || 0,
          is_selected: q.is_selected,
          // 图片题目特有字段
          images: q.images || [],
          // LaTeX题目特有字段
          latex_code: q.latex_code || ''
        };
      })
    });
    
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json({ message: '获取题目列表失败', error: error.message });
  }
};

module.exports = {
  getQuestionList
}; 