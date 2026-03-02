
classDiagram


class ProcessingStats {
            <<interface>>
            +processingTime?: number
+cost?: number
+qualityScore?: number
+resourceUsage?: #123; cpuTime?: number; memoryUsed?: number; gpuUsed?: boolean; containerUsed?: string; #125;
+errorCount?: number
+fallbackUsed?: boolean
            
        }
class Database {
            <<type>>
            +public: #123; Tables: { User: { Row: { id: string; email: string; name: string; subscriptionTier: SubscriptionTier; createdAt: string; updatedAt: string; deletedAt: string; #125;; Insert: Omit~{ id: string; ... 5 more ...; deletedAt: string; }, "id" | ... 1 more ... | "updatedAt"~; Update: Partial~...~; }; ... 4 more ...; UserPrefe...
            
        }
class AuthenticatedRequest {
            <<interface>>
            +user: #123; id: string; email: string; name: string; subscriptionTier: string; #125;
            
        }
FastifyRequest~RouteGeneric,RawServer,RawRequest,SchemaCompiler,TypeProvider,ContextConfig,Logger,RequestType~<|..AuthenticatedRequest
FastifyRequest<|..AuthenticatedRequest
FastifyRequest<|..AuthenticatedRequest
class WhisperMonitoring{
            -instance: WhisperMonitoring$
-healthChecks: Map~string, HealthCheckResult~
-systemMetrics: SystemMetrics
-alerts: Alert[]
-isMonitoring: boolean
-monitoringInterval: Timeout
-startTime: number
-alertsEnabled: boolean
            +getInstance() WhisperMonitoring$
+startMonitoring() void
+stopMonitoring() void
+getOverallHealth() #123; status: "healthy" | "unhealthy" | "degraded"; uptime: number; services: HealthCheckResult[]; systemMetrics: SystemMetrics; activeAlerts: Alert[]; #125;
+getServiceHealth() HealthCheckResult
+getAlerts() Alert[]
+resolveAlert() boolean
+requestMonitoring() (request: FastifyRequest~RouteGenericInterface, RawServerDefault, IncomingMessage, FastifySchema, FastifyTypeProviderDefault, unknown, FastifyBaseLogger, ResolveFastifyRequestType~...~~, _reply: FastifyReply~...~) =~ Promise~...~
+responseMonitoring() (request: FastifyRequest~RouteGenericInterface, RawServerDefault, IncomingMessage, FastifySchema, FastifyTypeProviderDefault, unknown, FastifyBaseLogger, ResolveFastifyRequestType~...~~, reply: FastifyReply~...~) =~ Promise~...~
+errorMonitoring() (error: any, request: FastifyRequest~RouteGenericInterface, RawServerDefault, IncomingMessage, FastifySchema, FastifyTypeProviderDefault, unknown, FastifyBaseLogger, ResolveFastifyRequestType~...~~, reply: FastifyReply~...~) =~ void
-performHealthChecks() Promise~void~
-checkHybridService() Promise~void~
-checkLocalWhisperService() Promise~void~
-checkDockerWhisperService() Promise~void~
-checkSystemHealth() Promise~void~
-updateSystemMetrics() void
-getInitialSystemMetrics() SystemMetrics
-getCpuUsage() number
-checkAlerts() void
-createAlert() void
-sendExternalAlert() void
-trackRequest() void
-trackError() void
        }
class HealthCheckResult {
            <<interface>>
            +service: string
+status: "healthy" | "unhealthy" | "degraded" | "unknown"
+uptime: number
+responseTime?: number
+errorRate?: number
+lastCheck: Date
+details?: any
            
        }
class SystemMetrics {
            <<interface>>
            +cpu: #123; usage: number; loadAverage: number[]; cores: number; #125;
+memory: #123; total: number; used: number; free: number; usage: number; processRss: number; processUsage: number; #125;
+disk: #123; usage?: number; available?: number; #125;
+processes: #123; whisperLocal?: ProcessInfo; whisperDocker?: ProcessInfo; #125;
            
        }
class ProcessInfo {
            <<interface>>
            +pid?: number
+memory: number
+cpu: number
+status: string
+startTime: Date
            
        }
class Alert {
            <<interface>>
            +id: string
+type: "error" | "warning" | "info"
+service: string
+message: string
+timestamp: Date
+resolved?: Date
+severity: "low" | "medium" | "high" | "critical"
            
        }
WhisperMonitoring  --  WhisperMonitoring
WhisperMonitoring  --  SystemMetrics
WhisperMonitoring  -- "0..*" Alert
class AuthenticatedUserRecord {
            <<interface>>
            +id: string
+email: string
+name: string
+subscriptionTier: string
+createdAt?: Date
+updatedAt?: Date
            
        }
class BatchQueue{
            -activeJobs: Map~string, #123; concurrency: number; processing: Set~string~; startTime: number; bytesProcessed: number; #125;~
-itemQueue: Map~string, QueuedItem[]~
            +startBatchJob() Promise~void~
+pauseBatchJob() Promise~void~
+resumeBatchJob() Promise~void~
+cancelBatchJob() Promise~void~
-processNextItems() Promise~void~
-processItem() Promise~void~
+handleItemCompleted() Promise~void~
-updateJobProgress() Promise~BatchJobProgress~
-checkJobCompletion() Promise~void~
+getBatchJobStatus() Promise~BatchJobProgress~
+retryItem() Promise~void~
        }
class BatchJobProgress {
            <<interface>>
            +jobId: string
+totalItems: number
+completedItems: number
+failedItems: number
+processingItems: number
+estimatedTimeRemaining?: number
+throughputMbps?: number
            
        }
class QueuedItem {
            <<interface>>
            +itemId: string
+jobId: string
+fileName: string
+audioPath: string
+startTime: number
            
        }
class HybridTranscriptionService{
            -instance: HybridTranscriptionService$
-whisperLocal?: WhisperServerService
-whisperDocker?: WhisperDockerService
-performanceMetrics: Map~TranscriptionMethod, MethodPerformance~
-config: HybridConfig
-lastOpenAiWarning: number
            +getInstance() HybridTranscriptionService$
+transcribe() Promise~TranscriptionResult~
+getServiceHealth() Promise~ServiceHealth~
+getLocalService() WhisperServerService
+getDockerService() WhisperDockerService
+getPerformanceMetrics() MethodPerformance[]
-selectOptimalMethod() Promise~TranscriptionMethod~
-transcribeWithMethod() Promise~any~
-transcribeWithOpenAI() Promise~any~
-getAvailableMethods() TranscriptionMethod[]
-getMethodsInOrder() TranscriptionMethod[]
-selectForSpeed() TranscriptionMethod
-selectForAccuracy() TranscriptionMethod
-selectForCost() TranscriptionMethod
-selectForPrivacy() TranscriptionMethod
-selectBalanced() TranscriptionMethod
-calculateCost() number
-calculateQualityScore() number
-getProcessingLocation() "cloud" | "local" | "container"
-recordMethodPerformance() void
-initializeMetrics() void
-estimateFileDuration() number
-getSystemLoad() number
-pingOpenAI() Promise~number~
        }
class HybridTranscriptionRequest {
            <<interface>>
            +filePath: string
+method: TranscriptionMethod
+options: TranscriptionOptions
+priority?: "speed" | "accuracy" | "cost" | "privacy"
+fallbackEnabled?: boolean
+userId?: string
+metadata?: Record~string, any~
            
        }
class TranscriptionOptions {
            <<interface>>
            +model?: WhisperModel
+language?: string
+task?: "transcribe" | "translate"
+wordTimestamps?: boolean
+temperature?: number
+maxTokens?: number
+threads?: number
            
        }
class TranscriptionResult {
            <<interface>>
            +id: string
+text: string
+segments?: TranscriptionSegment[]
+language?: string
+duration?: number
+processingTime: number
+method: TranscriptionMethod
+model?: string
+cost?: number
+fallbackUsed?: boolean
+metadata?: TranscriptionMetadata
            
        }
class TranscriptionSegment {
            <<interface>>
            +id: number
+start: number
+end: number
+text: string
+confidence?: number
            
        }
class TranscriptionMetadata {
            <<interface>>
            +fileSize: number
+fileDuration?: number
+processingLocation: "cloud" | "local" | "container"
+resourceUsage?: ResourceUsage
+qualityScore?: number
+errorCount?: number
            
        }
class ResourceUsage {
            <<interface>>
            +cpuTime?: number
+memoryUsed?: number
+gpuUsed?: boolean
+containerUsed?: string
            
        }
class ServiceHealth {
            <<interface>>
            +openai: #123; available: boolean; responseTime?: number; rateLimit?: number; #125;
+whisperLocal: #123; available: boolean; binaryExists: boolean; modelsAvailable: string[]; systemLoad?: number; #125;
+whisperDocker: #123; available: boolean; containerRunning: boolean; containerHealth?: string; modelsAvailable: string[]; #125;
            
        }
class MethodPerformance {
            <<interface>>
            +method: TranscriptionMethod
+averageTime: number
+successRate: number
+costPerMinute: number
+qualityScore: number
+lastUsed: Date
+usageCount: number
            
        }
class HybridConfig {
            <<interface>>
            +openaiApiKey: string
+openaiEndpoint: string
+enableOpenAI: boolean
+enableWhisperLocal: boolean
+enableWhisperDocker: boolean
+defaultMethod: TranscriptionMethod
+fallbackOrder: TranscriptionMethod[]
+costOptimization: boolean
+qualityThreshold: number
+maxRetries: number
+localWhisperConfig?: any
+dockerWhisperConfig?: any
            
        }
HybridTranscriptionService  --  HybridTranscriptionService
HybridTranscriptionService  --  WhisperServerService
HybridTranscriptionService  --  WhisperDockerService
HybridTranscriptionService  --  HybridConfig
HybridTranscriptionRequest  --  TranscriptionOptions
TranscriptionResult  -- "0..*" TranscriptionSegment
TranscriptionResult  --  TranscriptionMetadata
TranscriptionMetadata  --  ResourceUsage
class TranscriptionQueue{
            -queue: Map~string, any~
-processing: Set~string~
            +addJob() Promise~void~
-processNext() Promise~void~
-processJob() Promise~void~
+getQueueStatus() #123; queued: number; processing: number; jobs: { transcriptId: any; attempts: any; addedAt: any; #125;[]; }
        }
class StorageService{
            
            +uploadAudioFile() Promise~#123; path: string; signedUrl: string; #125;~$
+getFileUrl() Promise~string~$
+deleteAudioFile() Promise~void~$
+getUserStorageUsage() Promise~#123; fileCount: number; totalSize: number; #125;~$
        }
class TranscriptionService{
            -MAX_FILE_SIZE: number$
-SUPPORTED_FORMATS: string[]$
            +transcribeFile() Promise~#123; transcriptId: string; segments: any[]; language: string; duration: number; text: string; resourceUsage: ResourceUsage; model: string; #125;~$
-processTranscriptionResponse() Promise~any[]~$
-updateTranscriptStatus() Promise~void~$
+estimateCost() number$
+validateAudioFile() #123; valid: boolean; error?: string; #125;$
+extractMetadata() Promise~#123; duration?: number; bitrate?: number; sampleRate?: number; channels?: number; #125;~$
+retryTranscription() Promise~#123; message: string; #125;~$
        }
class WhisperDockerService{
            -config: WhisperDockerConfig
-processingJobs: Map~string, ProcessingJob~
-healthStatus: HealthStatus
-startTime: number
-containerUrl: string
            -initializeService() Promise~void~
+transcribeFile() Promise~TranscriptionResult~
+getHealthStatus() Promise~HealthStatus~
+startContainer() Promise~void~
+stopContainer() Promise~void~
+removeContainer() Promise~void~
+getJobStatus() ProcessingJob
+getActiveJobs() ProcessingJob[]
-checkDockerAvailability() Promise~void~
-ensureContainerRunning() Promise~void~
-createAndRunContainer() Promise~void~
-waitForContainerReady() Promise~void~
-getContainerInfo() Promise~DockerContainerInfo~
-getContainerId() Promise~string~
-copyFileToContainer() Promise~string~
-cleanupFile() Promise~void~
-executeTranscriptionRequest() Promise~TranscriptionResult~
-execDockerCommand() Promise~string~
-updateHealthStatus() Promise~void~
        }
class WhisperDockerOptions {
            <<interface>>
            +model?: WhisperModel
+language?: string
+task?: "transcribe" | "translate"
+threads?: number
+outputFormat?: "txt" | "vtt" | "srt" | "json"
+wordTimestamps?: boolean
+temperature?: number
+maxTokens?: number
+containerName?: string
+timeout?: number
            
        }
class TranscriptionResult {
            <<interface>>
            +text: string
+segments?: TranscriptionSegment[]
+language?: string
+duration?: number
+processingTime: number
+model: string
+method: "whisper-server-docker"
+containerId?: string
            
        }
class TranscriptionSegment {
            <<interface>>
            +id: number
+start: number
+end: number
+text: string
+confidence?: number
            
        }
class DockerContainerInfo {
            <<interface>>
            +id: string
+name: string
+status: string
+created: string
+ports: string[]
+image: string
            
        }
class HealthStatus {
            <<interface>>
            +status: "healthy" | "unhealthy" | "starting"
+dockerAvailable: boolean
+containerRunning: boolean
+containerInfo?: DockerContainerInfo
+availableModels: string[]
+systemInfo: #123; dockerVersion?: string; containerRuntime?: string; #125;
+uptime: number
            
        }
class ProcessingJob {
            <<interface>>
            +id: string
+status: "queued" | "processing" | "completed" | "failed"
+progress: number
+startTime: number
+endTime?: number
+error?: string
+result?: TranscriptionResult
+containerId?: string
            
        }
class WhisperDockerConfig {
            <<interface>>
            +containerImage: string
+containerName: string
+containerPort: number
+hostPort: number
+defaultModel: WhisperModel
+maxConcurrentJobs: number
+timeout: number
+autoStart: boolean
+volumePath: string
            
        }
WhisperDockerService  --  WhisperDockerConfig
WhisperDockerService  --  HealthStatus
TranscriptionResult  -- "0..*" TranscriptionSegment
HealthStatus  --  DockerContainerInfo
ProcessingJob  --  TranscriptionResult
class WhisperServerService{
            -config: WhisperServerConfig
-processingJobs: Map~string, ProcessingJob~
-healthStatus: HealthStatus
-startTime: number
            -initializeService() Promise~void~
+transcribeFile() Promise~TranscriptionResult~
+getAvailableModels() Promise~ModelInfo[]~
+getHealthStatus() Promise~HealthStatus~
+getJobStatus() ProcessingJob
+getActiveJobs() ProcessingJob[]
+cancelJob() boolean
-buildWhisperCommand() Promise~string[]~
-executeWhisper() Promise~TranscriptionResult~
-locateWhisperJsonForInput() Promise~string~
-parseWhisperOutput() TranscriptionResult
-updateHealthStatus() Promise~void~
-findWhisperBinary() string
-getDefaultModelsPath() string
        }
class WhisperOptions {
            <<interface>>
            +model?: WhisperModel
+language?: string
+task?: "transcribe" | "translate"
+threads?: number
+outputFormat?: "txt" | "vtt" | "srt" | "json"
+wordTimestamps?: boolean
+temperature?: number
+maxTokens?: number
+noSpeech?: number
+logLevel?: number
            
        }
class TranscriptionResult {
            <<interface>>
            +text: string
+segments?: TranscriptionSegment[]
+language?: string
+duration?: number
+processingTime: number
+model: string
+method: "whisper-server-local"
            
        }
class TranscriptionSegment {
            <<interface>>
            +id: number
+start: number
+end: number
+text: string
+confidence?: number
+words?: WordSegment[]
            
        }
class WordSegment {
            <<interface>>
            +word: string
+start: number
+end: number
+confidence: number
            
        }
class ModelInfo {
            <<interface>>
            +name: string
+size: number
+exists: boolean
+path: string
            
        }
class HealthStatus {
            <<interface>>
            +status: "healthy" | "unhealthy" | "starting"
+whisperBinary: boolean
+modelsDirectory: boolean
+availableModels: string[]
+systemInfo: #123; platform: string; arch: string; cpus: number; memory: number; #125;
+uptime: number
+version?: string
            
        }
class ProcessingJob {
            <<interface>>
            +id: string
+status: "queued" | "processing" | "completed" | "failed"
+progress: number
+startTime: number
+endTime?: number
+error?: string
+result?: TranscriptionResult
            
        }
class WhisperServerConfig {
            <<interface>>
            +whisperBinaryPath: string
+modelsPath: string
+tempPath: string
+defaultModel: WhisperModel
+maxConcurrentJobs: number
+cleanupTempFiles: boolean
+logLevel: number
            
        }
WhisperServerService  --  WhisperServerConfig
WhisperServerService  --  HealthStatus
TranscriptionResult  -- "0..*" TranscriptionSegment
TranscriptionSegment  -- "0..*" WordSegment
ProcessingJob  --  TranscriptionResult