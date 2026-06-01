// server/src/lib/analytics.js
// Core event tracking system for EnVX
// Logs every critical action: signup, project creation, invites, joins, pulls, pushes

const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

// ============================================
// SCHEMA: Run this ONCE on your database
// ============================================

const createAnalyticsSchema = async () => {
  const tableQueries = [
    // Main events table - logs everything
    `CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      project_id UUID,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );`,

    // Users table for cohort analysis
    `CREATE TABLE IF NOT EXISTS analytics_users (
      user_id UUID PRIMARY KEY,
      github_username VARCHAR(255) NOT NULL,
      first_event_at TIMESTAMP DEFAULT NOW(),
      last_event_at TIMESTAMP DEFAULT NOW(),
      total_events INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE
    );`,

    // Projects for aggregations
    `CREATE TABLE IF NOT EXISTS analytics_projects (
      project_id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      members_count INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      last_activity_at TIMESTAMP
    );`,

    // Funnels - tracks progression through key steps
    `CREATE TABLE IF NOT EXISTS funnel_events (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      step VARCHAR(50) NOT NULL,
      step_order INT NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, step)
    );`,

    // Daily metrics snapshot (denormalized for fast queries)
    `CREATE TABLE IF NOT EXISTS daily_metrics (
      date DATE PRIMARY KEY,
      new_users INT DEFAULT 0,
      new_projects INT DEFAULT 0,
      total_invites_sent INT DEFAULT 0,
      total_joins INT DEFAULT 0,
      total_pushes INT DEFAULT 0,
      total_pulls INT DEFAULT 0,
      viral_coefficient DECIMAL(4,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    // Retention cohorts
    `CREATE TABLE IF NOT EXISTS cohort_retention (
      cohort_date DATE NOT NULL,
      days_after_signup INT NOT NULL,
      user_count INT DEFAULT 0,
      active_count INT DEFAULT 0,
      retention_rate DECIMAL(5,2) DEFAULT 0,
      PRIMARY KEY (cohort_date, days_after_signup)
    );`
  ];

  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_events_event ON events(event_type);`,
    `CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);`,
    
    `CREATE INDEX IF NOT EXISTS idx_users_created ON analytics_users(first_event_at);`,
    
    `CREATE INDEX IF NOT EXISTS idx_projects_user ON analytics_projects(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_projects_created ON analytics_projects(created_at);`,
    
    `CREATE INDEX IF NOT EXISTS idx_funnel_user ON funnel_events(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_funnel_step ON funnel_events(step);`
  ];

  // Create tables first
  for (const query of tableQueries) {
    try {
      await sequelize.query(query);
    } catch (err) {
      console.error('❌ Table schema error:', err.message);
    }
  }

  // Create indexes next
  for (const query of indexQueries) {
    try {
      await sequelize.query(query);
    } catch (err) {
      console.error('❌ Index creation error:', err.message);
    }
  }

  console.log('✅ Analytics database schema initialized');
};

// ============================================
// EVENT TRACKING - Call these from your API
// ============================================

const trackEvent = async (userId, eventType, projectId = null, metadata = {}) => {
  try {
    // Log the event
    await sequelize.query(
      `INSERT INTO events (user_id, event_type, project_id, metadata, created_at)
       VALUES (:userId, :eventType, :projectId, :metadata, NOW())`,
      {
        replacements: {
          userId,
          eventType,
          projectId,
          metadata: JSON.stringify(metadata)
        }
      }
    );

    // Update user activity
    await sequelize.query(
      `INSERT INTO analytics_users (user_id, github_username, first_event_at, last_event_at, total_events, is_active)
       VALUES (:userId, :githubUsername, NOW(), NOW(), 1, TRUE)
       ON CONFLICT (user_id) DO UPDATE SET
         last_event_at = NOW(),
         total_events = analytics_users.total_events + 1`,
      {
        replacements: {
          userId,
          githubUsername: metadata.github_username || 'unknown'
        }
      }
    );

    // Update project activity
    if (projectId) {
      // Find current members count from DB
      const [membersData] = await sequelize.query(
        `SELECT COUNT(*) as count FROM "ProjectMembers" WHERE "projectId" = :projectId`,
        {
          replacements: { projectId },
          type: QueryTypes.SELECT
        }
      );
      const membersCount = parseInt(membersData ? membersData.count : 1, 10);

      await sequelize.query(
        `INSERT INTO analytics_projects (project_id, user_id, created_at, members_count, last_activity_at, is_active)
         VALUES (:projectId, :userId, NOW(), :membersCount, NOW(), TRUE)
         ON CONFLICT (project_id) DO UPDATE SET
           members_count = :membersCount,
           last_activity_at = NOW()`,
        {
          replacements: {
            projectId,
            userId,
            membersCount
          }
        }
      );
    }

    return { success: true };
  } catch (err) {
    console.error('❌ Track event error:', err);
    return { success: false, error: err.message };
  }
};

// Track funnel progression
const trackFunnelStep = async (userId, step, stepOrder) => {
  try {
    await sequelize.query(
      `INSERT INTO funnel_events (user_id, step, step_order, completed_at)
       VALUES (:userId, :step, :stepOrder, NOW())
       ON CONFLICT (user_id, step) DO UPDATE SET
         completed_at = NOW()`,
      {
        replacements: { userId, step, stepOrder }
      }
    );
    return { success: true };
  } catch (err) {
    console.error('❌ Funnel track error:', err);
    return { success: false, error: err.message };
  }
};

// ============================================
// KEY METRICS QUERIES - Use these for dashboard
// ============================================

const metrics = {
  // Total users
  totalUsers: async () => {
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM analytics_users WHERE is_active = TRUE
    `, { type: QueryTypes.SELECT });
    return result[0] ? parseInt(result[0].count, 10) : 0;
  },

  // Daily active users
  dailyActiveUsers: async (date = new Date()) => {
    const dateStr = date.toISOString().split('T')[0];
    const result = await sequelize.query(`
      SELECT COUNT(DISTINCT user_id) as count FROM events
      WHERE DATE(created_at) = :date
    `, {
      replacements: { date: dateStr },
      type: QueryTypes.SELECT
    });
    return result[0] ? parseInt(result[0].count, 10) : 0;
  },

  // Total projects created
  totalProjects: async () => {
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM analytics_projects WHERE is_active = TRUE
    `, { type: QueryTypes.SELECT });
    return result[0] ? parseInt(result[0].count, 10) : 0;
  },

  // Average team size (members per project)
  avgTeamSize: async () => {
    const result = await sequelize.query(`
      SELECT AVG(members_count) as avg FROM analytics_projects WHERE is_active = TRUE
    `, { type: QueryTypes.SELECT });
    return parseFloat(result[0] && result[0].avg ? result[0].avg : 0).toFixed(1);
  },

  // Projects with multiple members (sticky projects)
  projectsWithMultipleMembers: async () => {
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM analytics_projects
      WHERE is_active = TRUE AND members_count > 1
    `, { type: QueryTypes.SELECT });
    return result[0] ? parseInt(result[0].count, 10) : 0;
  },

  // Viral coefficient (invites sent / users)
  viralCoefficient: async (dayWindow = 7) => {
    const result = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM events WHERE event_type = 'invite' 
         AND created_at >= NOW() - INTERVAL '1 day' * :dayWindow) as total_invites,
        (SELECT COUNT(DISTINCT user_id) FROM events 
         WHERE created_at >= NOW() - INTERVAL '1 day' * :dayWindow) as total_users
    `, {
      replacements: { dayWindow },
      type: QueryTypes.SELECT
    });
    const { total_invites, total_users } = result[0] || { total_invites: 0, total_users: 0 };
    if (!total_users || parseInt(total_users, 10) === 0) return "0.00";
    return (parseInt(total_invites, 10) / parseInt(total_users, 10)).toFixed(2);
  },

  // Funnel completion rates
  funnelRates: async () => {
    const result = await sequelize.query(`
      SELECT 
        step,
        step_order,
        COUNT(DISTINCT user_id) as users_completed,
        ROUND(100.0 * COUNT(DISTINCT user_id) / 
          NULLIF((SELECT COUNT(DISTINCT user_id) FROM funnel_events WHERE step = 'signup'), 0)
        , 1) as completion_rate
      FROM funnel_events
      GROUP BY step, step_order
      ORDER BY step_order ASC
    `, { type: QueryTypes.SELECT });
    return result.map(row => ({
      step: row.step,
      users_completed: parseInt(row.users_completed, 10),
      completion_rate: parseFloat(row.completion_rate || 0)
    }));
  },

  // Churn: users who haven't been active in 7 days
  churnedUsers: async (daysInactive = 7) => {
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM analytics_users
      WHERE is_active = TRUE
      AND last_event_at < NOW() - INTERVAL '1 day' * :daysInactive
    `, {
      replacements: { daysInactive },
      type: QueryTypes.SELECT
    });
    return result[0] ? parseInt(result[0].count, 10) : 0;
  },

  // Retention cohort: % of users still active by day
  retentionCohort: async (cohortDays = 30) => {
    const result = await sequelize.query(`
      WITH signup_cohorts AS (
        SELECT 
          DATE(first_event_at) as cohort_date,
          user_id
        FROM analytics_users
      ),
      daily_activity AS (
        SELECT 
          DATE(created_at) as activity_date,
          user_id
        FROM events
        GROUP BY DATE(created_at), user_id
      )
      SELECT
        sc.cohort_date::text as cohort_date,
        (da.activity_date - sc.cohort_date)::int as days_after_signup,
        COUNT(DISTINCT sc.user_id) as users_in_cohort,
        COUNT(DISTINCT CASE WHEN da.user_id IS NOT NULL THEN sc.user_id END) as active_users,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN da.user_id IS NOT NULL THEN sc.user_id END) /
          NULLIF(COUNT(DISTINCT sc.user_id), 0), 1) as retention_rate
      FROM signup_cohorts sc
      LEFT JOIN daily_activity da ON sc.user_id = da.user_id
        AND da.activity_date >= sc.cohort_date
        AND (da.activity_date - sc.cohort_date)::int <= :cohortDays
      GROUP BY sc.cohort_date, (da.activity_date - sc.cohort_date)::int
      ORDER BY sc.cohort_date DESC, days_after_signup ASC
    `, {
      replacements: { cohortDays },
      type: QueryTypes.SELECT
    });
    return result.map(row => ({
      cohort_date: row.cohort_date,
      days_after_signup: parseInt(row.days_after_signup, 10),
      users_in_cohort: parseInt(row.users_in_cohort, 10),
      active_users: parseInt(row.active_users, 10),
      retention_rate: parseFloat(row.retention_rate || 0)
    }));
  },

  // Growth metrics by event type
  eventVolume: async (dayWindow = 7) => {
    const result = await sequelize.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        DATE(created_at)::text as date
      FROM events
      WHERE created_at >= NOW() - INTERVAL '1 day' * :dayWindow
      GROUP BY event_type, DATE(created_at)
      ORDER BY DATE(created_at) DESC, event_type
    `, {
      replacements: { dayWindow },
      type: QueryTypes.SELECT
    });
    return result.map(row => ({
      event_type: row.event_type,
      count: parseInt(row.count, 10),
      date: row.date
    }));
  },

  // Top projects by engagement
  topProjects: async (limit = 10) => {
    const result = await sequelize.query(`
      SELECT 
        ap.project_id::text as project_id,
        COUNT(DISTINCT e.user_id) as engagement_count,
        ap.members_count,
        ap.created_at::text as created_at,
        COUNT(CASE WHEN e.event_type = 'push' THEN 1 END) as pushes,
        COUNT(CASE WHEN e.event_type = 'pull' THEN 1 END) as pulls,
        COUNT(CASE WHEN e.event_type = 'invite' THEN 1 END) as invites
      FROM analytics_projects ap
      LEFT JOIN events e ON ap.project_id = e.project_id
      WHERE ap.is_active = TRUE
      GROUP BY ap.project_id, ap.members_count, ap.created_at
      ORDER BY engagement_count DESC
      LIMIT :limit
    `, {
      replacements: { limit },
      type: QueryTypes.SELECT
    });
    return result.map(row => ({
      project_id: row.project_id,
      engagement_count: parseInt(row.engagement_count, 10),
      members_count: parseInt(row.members_count, 10),
      created_at: row.created_at,
      pushes: parseInt(row.pushes, 10),
      pulls: parseInt(row.pulls, 10),
      invites: parseInt(row.invites, 10)
    }));
  },

  // Failure points: where users drop off
  dropoffAnalysis: async () => {
    const result = await sequelize.query(`
      SELECT 
        'signup_to_create' as funnel_stage,
        COUNT(DISTINCT CASE WHEN step = 'signup' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'create_project' THEN user_id END) as dropoff_count,
        ROUND(100.0 * (COUNT(DISTINCT CASE WHEN step = 'signup' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'create_project' THEN user_id END)) /
        NULLIF(COUNT(DISTINCT CASE WHEN step = 'signup' THEN user_id END), 0), 1) as dropoff_rate
      FROM funnel_events
      
      UNION ALL
      
      SELECT 
        'create_to_push' as funnel_stage,
        COUNT(DISTINCT CASE WHEN step = 'create_project' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'push_secrets' THEN user_id END) as dropoff_count,
        ROUND(100.0 * (COUNT(DISTINCT CASE WHEN step = 'create_project' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'push_secrets' THEN user_id END)) /
        NULLIF(COUNT(DISTINCT CASE WHEN step = 'create_project' THEN user_id END), 0), 1) as dropoff_rate
      FROM funnel_events
      
      UNION ALL
      
      SELECT 
        'push_to_invite' as funnel_stage,
        COUNT(DISTINCT CASE WHEN step = 'push_secrets' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'invite_user' THEN user_id END) as dropoff_count,
        ROUND(100.0 * (COUNT(DISTINCT CASE WHEN step = 'push_secrets' THEN user_id END) -
        COUNT(DISTINCT CASE WHEN step = 'invite_user' THEN user_id END)) /
        NULLIF(COUNT(DISTINCT CASE WHEN step = 'push_secrets' THEN user_id END), 0), 1) as dropoff_rate
      FROM funnel_events
    `, { type: QueryTypes.SELECT });
    
    return result.map(row => ({
      funnel_stage: row.funnel_stage,
      dropoff_count: parseInt(row.dropoff_count, 10),
      dropoff_rate: parseFloat(row.dropoff_rate || 0)
    }));
  },

  // Time to first action (how long after signup does user create project?)
  timeToFirstProject: async () => {
    const result = await sequelize.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (t2.created_at - t1.created_at))) / 3600 as avg_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (t2.created_at - t1.created_at))) / 3600 as median_hours,
        MIN(EXTRACT(EPOCH FROM (t2.created_at - t1.created_at))) / 3600 as min_hours,
        MAX(EXTRACT(EPOCH FROM (t2.created_at - t1.created_at))) / 3600 as max_hours
      FROM events t1
      JOIN events t2 ON t1.user_id = t2.user_id
      WHERE t1.event_type = 'login' AND t2.event_type = 'create_project'
      AND t2.created_at > t1.created_at
    `, { type: QueryTypes.SELECT });
    const row = result[0] || {};
    return {
      avg_hours: parseFloat(row.avg_hours || 0).toFixed(1),
      median_hours: parseFloat(row.median_hours || 0).toFixed(1),
      min_hours: parseFloat(row.min_hours || 0).toFixed(1),
      max_hours: parseFloat(row.max_hours || 0).toFixed(1)
    };
  },

  // Users by lifecycle stage
  lifecycleStages: async () => {
    const result = await sequelize.query(`
      SELECT 
        'New (0-1 days)' as stage,
        COUNT(*) as user_count
      FROM analytics_users
      WHERE first_event_at >= NOW() - INTERVAL '1 day'
      
      UNION ALL
      
      SELECT 
        'Active (1-7 days)' as stage,
        COUNT(*) as user_count
      FROM analytics_users
      WHERE first_event_at < NOW() - INTERVAL '1 day'
        AND last_event_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'Dormant (7-30 days)' as stage,
        COUNT(*) as user_count
      FROM analytics_users
      WHERE last_event_at < NOW() - INTERVAL '7 days'
        AND last_event_at >= NOW() - INTERVAL '30 days'
      
      UNION ALL
      
      SELECT 
        'Churned (>30 days)' as stage,
        COUNT(*) as user_count
      FROM analytics_users
      WHERE last_event_at < NOW() - INTERVAL '30 days'
    `, { type: QueryTypes.SELECT });
    
    return result.map(row => ({
      stage: row.stage,
      user_count: parseInt(row.user_count, 10)
    }));
  }
};

// ============================================
// BACKGROUND JOBS - Run these periodically
// ============================================

// Update daily metrics snapshot (run once per day)
const updateDailyMetrics = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [usersData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM analytics_users WHERE DATE(first_event_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );
    
    const [projectsData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM analytics_projects WHERE DATE(created_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );

    const [invitesData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM events WHERE event_type = 'invite' AND DATE(created_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );

    const [joinsData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM events WHERE event_type = 'join' AND DATE(created_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );

    const [pushesData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM events WHERE event_type = 'push' AND DATE(created_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );

    const [pullsData] = await sequelize.query(
      `SELECT COUNT(*) as count FROM events WHERE event_type = 'pull' AND DATE(created_at) = :today`,
      { replacements: { today }, type: QueryTypes.SELECT }
    );

    const viralCoeff = await metrics.viralCoefficient(1);

    await sequelize.query(
      `INSERT INTO daily_metrics (date, new_users, new_projects, total_invites_sent, total_joins, total_pushes, total_pulls, viral_coefficient, updated_at)
       VALUES (:today, :newUsers, :newProjects, :totalInvites, :totalJoins, :totalPushes, :totalPulls, :viralCoeff, NOW())
       ON CONFLICT (date) DO UPDATE SET
         new_users = :newUsers,
         new_projects = :newProjects,
         total_invites_sent = :totalInvites,
         total_joins = :totalJoins,
         total_pushes = :totalPushes,
         total_pulls = :totalPulls,
         viral_coefficient = :viralCoeff,
         updated_at = NOW()`,
      {
        replacements: {
          today,
          newUsers: parseInt(usersData ? usersData.count : 0, 10),
          newProjects: parseInt(projectsData ? projectsData.count : 0, 10),
          totalInvites: parseInt(invitesData ? invitesData.count : 0, 10),
          totalJoins: parseInt(joinsData ? joinsData.count : 0, 10),
          totalPushes: parseInt(pushesData ? pushesData.count : 0, 10),
          totalPulls: parseInt(pullsData ? pullsData.count : 0, 10),
          viralCoeff
        }
      }
    );

    console.log('✅ Daily snapshot metrics updated successfully');
  } catch (error) {
    console.error('❌ Update daily metrics snapshot error:', error);
  }
};

// Mark inactive users as churned (run daily)
const markChurnedUsers = async (daysInactive = 7) => {
  try {
    await sequelize.query(
      `UPDATE analytics_users 
       SET is_active = FALSE
       WHERE is_active = TRUE 
       AND last_event_at < NOW() - INTERVAL '1 day' * :daysInactive`,
      {
        replacements: { daysInactive }
      }
    );
    console.log('✅ Churned user profiles updated successfully');
  } catch (error) {
    console.error('❌ Mark churned users error:', error);
  }
};

module.exports = {
  createAnalyticsSchema,
  trackEvent,
  trackFunnelStep,
  metrics,
  updateDailyMetrics,
  markChurnedUsers
};
