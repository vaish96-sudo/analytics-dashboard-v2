import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import * as projectService from '../lib/projectService'

const ProjectContext = createContext(null)

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}

export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [sharedProjects, setSharedProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [activeProject, setActiveProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projectLoading, setProjectLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setProjects([])
      setSharedProjects([])
      setActiveProjectId(null)
      setActiveProject(null)
      setLoading(false)
      return
    }
    loadProjects()
  }, [user?.id])

  const loadProjects = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [list, shared] = await Promise.all([
        projectService.listProjects(user.id),
        projectService.listSharedProjects(user.id).catch(() => []),
      ])
      setProjects(list)
      setSharedProjects(shared)

      const savedId = localStorage.getItem('nb_active_project')
      if (savedId && list.some(p => p.id === savedId)) {
        await selectProject(savedId)
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectProject = useCallback(async (projectId) => {
    if (!projectId) {
      setActiveProjectId(null)
      setActiveProject(null)
      localStorage.removeItem('nb_active_project')
      return
    }

    setProjectLoading(true)
    try {
      const project = await projectService.getProject(projectId)
      setActiveProjectId(projectId)
      setActiveProject(project)
      localStorage.setItem('nb_active_project', projectId)
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setProjectLoading(false)
    }
  }, [])

  const createProject = useCallback(async ({ name, clientName, dataSourceType, dataSourceMeta }) => {
    if (!user) throw new Error('Not authenticated')

    const project = await projectService.createProject(user.id, {
      name,
      clientName,
      dataSourceType,
      dataSourceMeta,
    })

    setProjects(prev => [project, ...prev])
    await selectProject(project.id)
    return project
  }, [user, selectProject])

  const deleteProjectById = useCallback(async (projectId) => {
    await projectService.deleteProject(projectId)
    setProjects(prev => prev.filter(p => p.id !== projectId))

    if (activeProjectId === projectId) {
      setActiveProjectId(null)
      setActiveProject(null)
      localStorage.removeItem('nb_active_project')
    }
  }, [activeProjectId])

  const renameProject = useCallback(async (projectId, name) => {
    const updated = await projectService.updateProject(projectId, { name })
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: updated.name } : p))
    if (activeProjectId === projectId && activeProject) {
      setActiveProject(prev => ({ ...prev, name: updated.name }))
    }
  }, [activeProjectId, activeProject])

  const addDatasetToProject = useCallback(async ({ fileName, schemaDef, rowCount, rawData }) => {
    if (!activeProjectId) throw new Error('No active project')

    const dataset = await projectService.createDataset(activeProjectId, {
      fileName,
      schemaDef,
      rowCount,
      rawData,
    })

    await selectProject(activeProjectId)
    return dataset
  }, [activeProjectId, selectProject])

  const removeDatasetFromProject = useCallback(async (datasetId) => {
    await projectService.deleteDataset(datasetId)
    await selectProject(activeProjectId)
  }, [activeProjectId, selectProject])

  const isSharedView = activeProject && user && activeProject.user_id !== user.id

  // Get shared role via API
  const [sharedRole, setSharedRole] = useState(null)
  useEffect(() => {
    if (!isSharedView || !user?.id) { setSharedRole(null); return }
    // Fetch the user's team membership role from the API
    api.get('/api/data/user-profile')
      .then(profile => setSharedRole(profile?.role || 'viewer'))
      .catch(() => setSharedRole('viewer'))
  }, [isSharedView, user?.id])

  const canEdit = !isSharedView || sharedRole === 'admin' || sharedRole === 'editor'

  return (
    <ProjectContext.Provider value={{
      projects,
      sharedProjects,
      activeProjectId,
      activeProject,
      loading,
      projectLoading,
      loadProjects,
      selectProject,
      createProject,
      deleteProject: deleteProjectById,
      renameProject,
      addDatasetToProject,
      removeDatasetFromProject,
      isSharedView,
      sharedRole,
      canEdit,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}
