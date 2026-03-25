import { api } from '../lib/api'

// ============================================================
// PROJECTS
// ============================================================

export async function createProject(userId, { name, clientName, dataSourceType, dataSourceMeta }) {
  return api.post('/api/data/projects', { name, clientName, dataSourceType, dataSourceMeta })
}

export async function listProjects(userId) {
  return api.get('/api/data/projects')
}

export async function listSharedProjects(userId) {
  return api.get('/api/data/shared-projects')
}

export async function getClientAccess(userId, teamId) {
  // This info comes as part of the shared-projects logic on the server
  // For direct usage, we can add a dedicated endpoint later
  // For now, the sharing menus call the API directly
  return []
}

export async function grantClientAccess(teamId, userId, clientName) {
  return api.post('/api/data/client-access', { teamId, targetUserId: userId, clientName })
}

export async function revokeClientAccess(teamId, userId, clientName) {
  return api.del(`/api/data/client-access?teamId=${teamId}&targetUserId=${userId}&clientName=${encodeURIComponent(clientName)}`)
}

export async function grantProjectAccess(teamId, userId, projectId) {
  return api.post('/api/data/project-access', { teamId, targetUserId: userId, projectId })
}

export async function revokeProjectAccess(teamId, userId, projectId) {
  return api.del(`/api/data/project-access?teamId=${teamId}&targetUserId=${userId}&projectId=${projectId}`)
}

export async function getProject(projectId) {
  return api.get(`/api/data/project/${projectId}`)
}

export async function updateProject(projectId, updates) {
  return api.patch(`/api/data/project/${projectId}`, updates)
}

export async function deleteProject(projectId) {
  return api.del(`/api/data/project/${projectId}`)
}

// ============================================================
// DATASETS
// ============================================================

export async function createDataset(projectId, { fileName, schemaDef, rowCount, rawData }) {
  const data = await api.post('/api/data/datasets', { projectId, fileName, schemaDef, rowCount, rawData })
  // The frontend expects _fullRawData to be populated after creation
  data._fullRawData = rawData
  return data
}

// Download raw data — now goes through the API route which handles decompression server-side
export async function downloadRawData(rawDataPath, datasetId) {
  if (!datasetId) return []
  try {
    const data = await api.get(`/api/data/dataset/${datasetId}`)
    return data?.raw_data || []
  } catch {
    return []
  }
}

export async function updateDataset(datasetId, updates) {
  // Not currently used but available via project PATCH
  return updates
}

export async function deleteDataset(datasetId) {
  return api.del(`/api/data/dataset/${datasetId}`)
}

// ============================================================
// DASHBOARD STATE
// ============================================================

export async function getDashboardState(datasetId) {
  try {
    return await api.get(`/api/data/dashboard-state?dataset_id=${datasetId}`)
  } catch {
    return null
  }
}

export async function saveDashboardState(datasetId, state) {
  return api.patch('/api/data/dashboard-state', { datasetId, ...state })
}

export async function saveInsightsOnly(datasetId, insights, insightsLoaded) {
  return api.post('/api/data/dashboard-state', { datasetId, insights, insightsLoaded })
}

// ============================================================
// CONVERSATIONS
// ============================================================

export async function listConversations(projectId) {
  return api.get(`/api/data/conversations?project_id=${projectId}`)
}

export async function createConversation(projectId, datasetId) {
  return api.post('/api/data/conversations', { projectId, datasetId })
}

export async function updateConversation(conversationId, updates) {
  return api.patch(`/api/data/conversation/${conversationId}`, updates)
}

export async function deleteConversation(conversationId) {
  return api.del(`/api/data/conversation/${conversationId}`)
}

// ============================================================
// MESSAGES
// ============================================================

export async function getMessages(conversationId) {
  return api.get(`/api/data/messages?conversation_id=${conversationId}`)
}

export async function addMessage(conversationId, { role, content, sqlPlan, meta }) {
  return api.post('/api/data/messages', { conversationId, role, content, sqlPlan, meta })
}

// ============================================================
// CROSS-PROJECT QUERIES (for home screen)
// ============================================================

export async function listAllConversations(userId) {
  return api.get('/api/data/all-conversations')
}

export async function listAllInsights(userId) {
  return api.get('/api/data/all-insights')
}
