import React, { useState, useEffect } from 'react';

interface Project {
  path: string;
  name: string;
  lastOpened: string;
}

interface ProjectSelectorProps {
  onProjectSelected: (projectPath: string) => void;
  onClose: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onProjectSelected,
  onClose
}) => {
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    try {
      const projects = await (window as any).electronAPI.getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error('Error loading recent projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (projectPath: string) => {
    try {
      await (window as any).electronAPI.saveRecentProject(projectPath);
      onProjectSelected(projectPath);
    } catch (error) {
      console.error('Error selecting project:', error);
    }
  };

  const handleBrowseProject = async () => {
    try {
      const selectedPath = await (window as any).electronAPI.selectProjectDirectory();
      if (selectedPath) {
        handleSelectProject(selectedPath);
      }
    } catch (error) {
      console.error('Error browsing for project:', error);
    }
  };

  const handleUseCurrentDirectory = async () => {
    try {
      const currentDir = await (window as any).electronAPI.getCurrentDirectory();
      handleSelectProject(currentDir);
    } catch (error) {
      console.error('Error getting current directory:', error);
    }
  };

  return (
    <div className="project-selector-overlay">
      <div className="project-selector-modal">
        <div className="project-selector-header">
          <h2>Select Project</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        <div className="project-selector-content">
          <div className="project-actions">
            <button 
              onClick={handleBrowseProject}
              className="project-action-btn primary"
            >
              📁 Browse for Project
            </button>
            <button 
              onClick={handleUseCurrentDirectory}
              className="project-action-btn secondary"
            >
              📂 Use Current Directory
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading recent projects...</div>
          ) : recentProjects.length > 0 ? (
            <div className="recent-projects">
              <h3>Recent Projects</h3>
              <div className="project-list">
                {recentProjects.map((project, index) => (
                  <div 
                    key={index}
                    className="project-item"
                    onClick={() => handleSelectProject(project.path)}
                  >
                    <div className="project-info">
                      <div className="project-name">{project.name}</div>
                      <div className="project-path">{project.path}</div>
                      <div className="project-last-opened">
                        Last opened: {new Date(project.lastOpened).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-recent-projects">
              <p>No recent projects found. Use the buttons above to select a project.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
