import { CodeOutlined, PlusOutlined } from '@ant-design/icons'
import { nanoid } from '@reduxjs/toolkit'
import DragableList from '@renderer/components/DragableList'
import IndicatorLight from '@renderer/components/IndicatorLight'
import { HStack, VStack } from '@renderer/components/Layout'
import Scrollbar from '@renderer/components/Scrollbar'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { MCPServer } from '@renderer/types'
import { getModelScopeToken, saveModelScopeToken, syncModelScopeServers } from '@renderer/utils/modelScopeUtils'
import { Dropdown, Input, Menu, Modal } from 'antd'
import { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingTitle } from '..'
import McpSettings from './McpSettings'

interface Props {
  selectedMcpServer: MCPServer | null
  setSelectedMcpServer: (server: MCPServer | null) => void
}

const McpServersList: FC<Props> = ({ selectedMcpServer, setSelectedMcpServer }) => {
  const { mcpServers, addMCPServer, updateMcpServers } = useMCPServers()
  const { t } = useTranslation()
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const onAddMcpServer = useCallback(async () => {
    const newServer = {
      id: nanoid(),
      name: t('settings.mcp.newServer'),
      description: '',
      baseUrl: '',
      command: '',
      args: [],
      env: {},
      isActive: false
    }
    addMCPServer(newServer)
    window.message.success({ content: t('settings.mcp.addSuccess'), key: 'mcp-list' })
    setSelectedMcpServer(newServer)
  }, [addMCPServer, setSelectedMcpServer, t])

  const onSyncFromModelScope = useCallback(async () => {
    try {
      // Check if we have a saved token
      const token = getModelScopeToken()

      // If no token is saved, prompt for one
      if (!token) {
        setTokenInput('')
        setIsTokenModalVisible(true)
        return
      }

      // Continue with the token we have
      await handleModelScopeSync(token)
    } catch (error) {
      console.error('Error syncing from ModelScope:', error)
      window.message.error({
        content: t('settings.mcp.syncError'),
        key: 'mcp-sync'
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpServers, addMCPServer, setSelectedMcpServer, t])

  // Handler for ModelScope sync process
  const handleModelScopeSync = async (token: string) => {
    setIsSyncing(true)
    window.message.loading({ content: t('settings.mcp.syncingFromModelScope'), key: 'mcp-sync' })

    try {
      const result = await syncModelScopeServers(token, mcpServers)

      // Display result message
      if (result.success) {
        if (result.addedServers.length > 0) {
          // Add all new servers
          result.addedServers.forEach((server) => {
            addMCPServer(server)
          })

          // Select the first newly added server
          if (result.addedServers[0]) {
            setSelectedMcpServer(result.addedServers[0])
          }

          window.message.success({
            content: result.message,
            key: 'mcp-sync'
          })
        } else {
          window.message.info({
            content: result.message,
            key: 'mcp-sync'
          })
        }
      } else {
        // Handle error case
        window.message.error({
          content: result.message,
          key: 'mcp-sync'
        })

        // If the token was invalid, show the token modal again
        if (result.message === t('settings.mcp.unauthorized')) {
          setTokenInput('')
          setIsTokenModalVisible(true)
        }
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle token submission
  const handleTokenSubmit = () => {
    if (tokenInput.trim()) {
      // Save the token
      saveModelScopeToken(tokenInput.trim())
      setIsTokenModalVisible(false)

      // Continue with the sync using the new token
      handleModelScopeSync(tokenInput.trim())
    }
  }

  const menu = (
    <Menu>
      <Menu.Item key="add-local" onClick={onAddMcpServer}>
        {t('settings.mcp.addLocalServer')}
      </Menu.Item>
      <Menu.Item key="sync-modelscope" onClick={onSyncFromModelScope} disabled={isSyncing}>
        {t('settings.mcp.syncFromModelScope')}
      </Menu.Item>
    </Menu>
  )

  return (
    <Container>
      <ServersList>
        <ListHeader>
          <SettingTitle>{t('settings.mcp.newServer')}</SettingTitle>
        </ListHeader>
        <Dropdown overlay={menu} trigger={['click']} placement="bottomCenter">
          <AddServerCard>
            <PlusOutlined style={{ fontSize: 24 }} />
            <AddServerText>{t('settings.mcp.addServer')}</AddServerText>
          </AddServerCard>
        </Dropdown>
        <DragableList list={mcpServers} onUpdate={updateMcpServers}>
          {(server) => (
            <ServerCard
              key={server.id}
              onClick={() => setSelectedMcpServer(server)}
              className={selectedMcpServer?.id === server.id ? 'active' : ''}>
              <ServerHeader>
                <ServerIcon>
                  <CodeOutlined />
                </ServerIcon>
                <ServerName>{server.name}</ServerName>
                <StatusIndicator>
                  <IndicatorLight
                    size={6}
                    color={server.isActive ? 'green' : 'var(--color-text-3)'}
                    animation={server.isActive}
                    shadow={false}
                  />
                </StatusIndicator>
              </ServerHeader>
              <ServerDescription>{server.description}</ServerDescription>
            </ServerCard>
          )}
        </DragableList>
      </ServersList>
      <ServerSettings>{selectedMcpServer && <McpSettings server={selectedMcpServer} />}</ServerSettings>

      {/* Token Input Modal with improved UX */}
      <Modal
        title={t('settings.mcp.modelScopeTokenTitle') || 'ModelScope Token'}
        visible={isTokenModalVisible}
        onOk={handleTokenSubmit}
        onCancel={() => setIsTokenModalVisible(false)}
        okButtonProps={{ disabled: !tokenInput.trim() }}
        okText={t('common.confirm') || 'Confirm'}
        cancelText={t('common.cancel') || 'Cancel'}>
        <p>{t('settings.mcp.modelScopeTokenDescription') || 'Please enter your ModelScope API token:'}</p>
        <Input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder={t('settings.mcp.tokenPlaceholder') || 'Enter your token here'}
          autoFocus
        />
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-3)' }}>
          {t('settings.mcp.tokenHelp') || 'Your token can be found in your ModelScope account settings.'}
        </div>
      </Modal>
    </Container>
  )
}

const Container = styled(HStack)`
  flex: 1;
  width: 350px;
  height: calc(100vh - var(--navbar-height));
  overflow: hidden;
`

const ServersList = styled(Scrollbar)`
  gap: 16px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
  width: 350px;
  padding: 15px;
  border-right: 0.5px solid var(--color-border);
`

const ServerSettings = styled(VStack)`
  flex: 1;
  height: calc(100vh - var(--navbar-height));
`

const ListHeader = styled.div`
  width: 100%;

  h2 {
    font-size: 20px;
    margin: 0;
  }
`

const ServerCard = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 120px;
  background-color: var(--color-background);

  &:hover,
  &.active {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`

const ServerHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 5px;
`

const ServerIcon = styled.div`
  font-size: 18px;
  color: var(--color-primary);
  margin-right: 8px;
`

const ServerName = styled.div`
  font-weight: 500;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const StatusIndicator = styled.div`
  margin-left: 8px;
`

const ServerDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  width: 100%;
  word-break: break-word;
`

const AddServerCard = styled(ServerCard)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-style: dashed;
  background-color: transparent;
  color: var(--color-text-2);
`

const AddServerText = styled.div`
  margin-top: 12px;
  font-weight: 500;
`

export default McpServersList
