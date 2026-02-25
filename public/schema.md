generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model AdminActionLog {
  id           Int      @id @default(autoincrement())
  adminId      Int
  targetUserId Int?
  action       String
  details      Json?
  createdAt    DateTime @default(now())
  User         User     @relation(fields: [adminId], references: [id])

  @@index([adminId, createdAt])
  @@index([targetUserId, createdAt])
}

model AdminMessage {
  id                              Int               @id @default(autoincrement())
  adminId                         Int
  userId                          Int?
  title                           String
  content                         String
  messageType                     String            @default("info")
  isActive                        Boolean           @default(true)
  sendAt                          DateTime?
  readCount                       Int               @default(0)
  totalSent                       Int               @default(0)
  metadata                        Json?
  createdAt                       DateTime          @default(now())
  updatedAt                       DateTime
  User_AdminMessage_adminIdToUser User              @relation("AdminMessage_adminIdToUser", fields: [adminId], references: [id])
  User_AdminMessage_userIdToUser  User?             @relation("AdminMessage_userIdToUser", fields: [userId], references: [id])
  UserMessageRead                 UserMessageRead[]

  @@index([adminId, createdAt])
  @@index([userId, isActive, createdAt])
}

model AdminNotification {
  id                Int       @id @default(autoincrement())
  userId            Int?
  notificationType  String
  title             String
  content           String
  relatedCustomerId Int?
  relatedNoteId     Int?
  relatedMessageId  Int?
  isRead            Boolean   @default(false)
  readAt            DateTime?
  priority          String    @default("normal")
  metadata          Json?
  createdAt         DateTime  @default(now())
  User              User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([notificationType, createdAt])
  @@index([relatedCustomerId, createdAt])
  @@index([userId, isRead, createdAt])
}

model AdminSmsConfig {
  id             Int      @id @default(autoincrement())
  adminId        Int      @unique
  provider       String   @default("aligo")
  apiKey         String
  userId         String
  senderPhone    String
  kakaoSenderKey String?
  kakaoChannelId String?
  isActive       Boolean  @default(true)
  metadata       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime
  User           User     @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId, isActive])
}

model AffiliateAuditLog {
  id                Int                @id @default(autoincrement())
  category          String
  action            String
  contractId        Int?
  saleId            Int?
  profileId         Int?
  userId            Int?
  performedById     Int?
  performedBySystem Boolean            @default(false)
  details           Json?
  metadata          Json?
  createdAt         DateTime           @default(now())
  AffiliateContract AffiliateContract? @relation(fields: [contractId], references: [id])
  User              User?              @relation(fields: [performedById], references: [id])
  AffiliateProfile  AffiliateProfile?  @relation(fields: [profileId], references: [id])
  AffiliateSale     AffiliateSale?     @relation(fields: [saleId], references: [id])

  @@index([category, createdAt])
  @@index([contractId, createdAt])
  @@index([performedById, createdAt])
  @@index([profileId, createdAt])
  @@index([saleId, createdAt])
  @@index([userId, createdAt])
}

model AffiliateCommissionTier {
  id                 Int              @id @default(autoincrement())
  affiliateProductId Int
  cabinType          String
  pricingRowId       String?
  fareCategory       String?
  fareLabel          String?
  saleAmount         Int?
  costAmount         Int?
  hqShareAmount      Int?
  branchShareAmount  Int?
  salesShareAmount   Int?
  overrideAmount     Int?
  currency           String           @default("KRW")
  metadata           Json?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime
  AffiliateProduct   AffiliateProduct @relation(fields: [affiliateProductId], references: [id], onDelete: Cascade)

  @@unique([affiliateProductId, cabinType, fareCategory, fareLabel])
  @@index([pricingRowId])
}

model AffiliateContract {
  id                                      Int                 @id @default(autoincrement())
  userId                                  Int?
  name                                    String
  residentId                              String
  phone                                   String
  email                                   String?
  address                                 String
  bankName                                String?
  bankAccount                             String?
  bankAccountHolder                       String?
  idCardPath                              String?
  idCardOriginalName                      String?
  bankbookPath                            String?
  bankbookOriginalName                    String?
  invitedByProfileId                      Int?
  consentPrivacy                          Boolean             @default(false)
  consentNonCompete                       Boolean             @default(false)
  consentDbUse                            Boolean             @default(false)
  consentPenalty                          Boolean             @default(false)
  status                                  String              @default("submitted")
  notes                                   String?
  metadata                                Json?
  submittedAt                             DateTime            @default(now())
  reviewedAt                              DateTime?
  reviewerId                              Int?
  contractSignedAt                        DateTime?
  createdAt                               DateTime            @default(now())
  updatedAt                               DateTime
  contractEndDate                         DateTime?
  contractStartDate                       DateTime?
  signatureLink                           String?
  signatureLinkExpiresAt                  DateTime?
  AffiliateAuditLog                       AffiliateAuditLog[]
  AffiliateProfile                        AffiliateProfile?   @relation(fields: [invitedByProfileId], references: [id])
  User_AffiliateContract_reviewerIdToUser User?               @relation("AffiliateContract_reviewerIdToUser", fields: [reviewerId], references: [id])
  User_AffiliateContract_userIdToUser     User?               @relation("AffiliateContract_userIdToUser", fields: [userId], references: [id])
  AffiliateDocument                       AffiliateDocument[]

  @@index([invitedByProfileId])
  @@index([phone, status])
  @@index([status, submittedAt])
}

model AffiliateDocument {
  id                                        Int                @id @default(autoincrement())
  profileId                                 Int
  documentType                              String
  status                                    String             @default("UPLOADED")
  filePath                                  String
  fileName                                  String?
  fileSize                                  Int?
  fileHash                                  String?
  uploadedById                              Int?
  approvedById                              Int?
  uploadedAt                                DateTime           @default(now())
  reviewedAt                                DateTime?
  metadata                                  Json?
  affiliateContractId                       Int?
  AffiliateContract                         AffiliateContract? @relation(fields: [affiliateContractId], references: [id])
  User_AffiliateDocument_approvedByIdToUser User?              @relation("AffiliateDocument_approvedByIdToUser", fields: [approvedById], references: [id])
  AffiliateProfile                          AffiliateProfile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  User_AffiliateDocument_uploadedByIdToUser User?              @relation("AffiliateDocument_uploadedByIdToUser", fields: [uploadedById], references: [id])
  AffiliateMedia                            AffiliateMedia[]

  @@index([profileId, documentType])
}

model AffiliateInteraction {
  id               Int               @id @default(autoincrement())
  leadId           Int
  profileId        Int?
  createdById      Int
  interactionType  String
  occurredAt       DateTime          @default(now())
  note             String?
  metadata         Json?
  User             User              @relation(fields: [createdById], references: [id], onDelete: Cascade)
  AffiliateLead    AffiliateLead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  AffiliateProfile AffiliateProfile? @relation(fields: [profileId], references: [id])
  AffiliateMedia   AffiliateMedia[]

  @@index([leadId, occurredAt])
}

model AffiliateLead {
  id                                                                 Int                    @id @default(autoincrement())
  linkId                                                             Int?
  managerId                                                          Int?
  agentId                                                            Int?
  customerName                                                       String?
  customerPhone                                                      String?
  status                                                             String                 @default("NEW")
  source                                                             String?
  passportRequestedAt                                                DateTime?
  passportCompletedAt                                                DateTime?
  lastContactedAt                                                    DateTime?
  nextActionAt                                                       DateTime?
  notes                                                              String?
  metadata                                                           Json?
  createdAt                                                          DateTime               @default(now())
  updatedAt                                                          DateTime
  groupId                                                            Int?
  sharedToManagerId                                                  Int?
  AffiliateInteraction                                               AffiliateInteraction[]
  AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile           AffiliateProfile?      @relation("AffiliateLead_agentIdToAffiliateProfile", fields: [agentId], references: [id])
  PartnerCustomerGroup                                               PartnerCustomerGroup?  @relation(fields: [groupId], references: [id])
  AffiliateLink                                                      AffiliateLink?         @relation(fields: [linkId], references: [id])
  AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile         AffiliateProfile?      @relation("AffiliateLead_managerIdToAffiliateProfile", fields: [managerId], references: [id])
  AffiliateProfile_AffiliateLead_sharedToManagerIdToAffiliateProfile AffiliateProfile?      @relation("AffiliateLead_sharedToManagerIdToAffiliateProfile", fields: [sharedToManagerId], references: [id])
  AffiliateSale                                                      AffiliateSale[]
  DocumentApproval                                                   DocumentApproval[]

  @@index([agentId, createdAt])
  @@index([agentId, status])
  @@index([createdAt])
  @@index([customerPhone])
  @@index([customerPhone, status, createdAt])
  @@index([groupId])
  @@index([lastContactedAt])
  @@index([managerId, agentId, status])
  @@index([managerId, createdAt])
  @@index([managerId, status])
  @@index([nextActionAt])
  @@index([status])
  @@index([updatedAt])
}

model AffiliateLedger {
  id                Int              @id @default(autoincrement())
  saleId            Int
  profileId         Int
  type              String
  amount            Int
  withholdingAmount Int              @default(0)
  netAmount         Int
  isSettled         Boolean          @default(false)
  settledAt         DateTime?
  description       String?
  metadata          Json?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime
  AffiliateProfile  AffiliateProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  AffiliateSale     AffiliateSale    @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([isSettled])
  @@index([profileId, createdAt])
  @@index([saleId])
  @@index([type])
}

model AffiliateLink {
  id                                                         Int                  @id @default(autoincrement())
  code                                                       String               @unique
  title                                                      String?
  affiliateProductId                                         Int?
  productCode                                                String?
  managerId                                                  Int?
  agentId                                                    Int?
  issuedById                                                 Int
  status                                                     String               @default("ACTIVE")
  expiresAt                                                  DateTime?
  lastAccessedAt                                             DateTime?
  campaignName                                               String?
  description                                                String?
  landingVariant                                             String?
  utmSource                                                  String?
  utmMedium                                                  String?
  utmCampaign                                                String?
  utmContent                                                 String?
  utmTerm                                                    String?
  metadata                                                   Json?
  createdAt                                                  DateTime             @default(now())
  updatedAt                                                  DateTime
  AffiliateLead                                              AffiliateLead[]
  AffiliateProduct                                           AffiliateProduct?    @relation(fields: [affiliateProductId], references: [id])
  AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile   AffiliateProfile?    @relation("AffiliateLink_agentIdToAffiliateProfile", fields: [agentId], references: [id])
  User                                                       User                 @relation(fields: [issuedById], references: [id], onDelete: Cascade)
  AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile AffiliateProfile?    @relation("AffiliateLink_managerIdToAffiliateProfile", fields: [managerId], references: [id])
  AffiliateLinkEvent                                         AffiliateLinkEvent[]
  AffiliateSale                                              AffiliateSale[]

  @@index([agentId])
  @@index([campaignName])
  @@index([managerId])
  @@index([status])
  @@index([utmSource, utmMedium, utmCampaign])
}

model AffiliateLinkEvent {
  id            Int           @id @default(autoincrement())
  linkId        Int
  actorId       Int?
  eventType     String
  description   String?
  metadata      Json?
  createdAt     DateTime      @default(now())
  User          User?         @relation(fields: [actorId], references: [id])
  AffiliateLink AffiliateLink @relation(fields: [linkId], references: [id], onDelete: Cascade)

  @@index([linkId, createdAt])
}

model AffiliateMedia {
  id                   Int                   @id @default(autoincrement())
  interactionId        Int?
  documentId           Int?
  storagePath          String
  fileName             String?
  fileSize             Int?
  mimeType             String?
  visibility           String                @default("INTERNAL")
  uploadedById         Int?
  metadata             Json?
  createdAt            DateTime              @default(now())
  AffiliateDocument    AffiliateDocument?    @relation(fields: [documentId], references: [id])
  AffiliateInteraction AffiliateInteraction? @relation(fields: [interactionId], references: [id])
  User                 User?                 @relation(fields: [uploadedById], references: [id])

  @@index([documentId])
  @@index([interactionId])
}

model AffiliatePayslip {
  id               Int              @id @default(autoincrement())
  profileId        Int
  period           String
  type             String
  totalSales       Int              @default(0)
  totalCommission  Int              @default(0)
  totalWithholding Int              @default(0)
  netPayment       Int              @default(0)
  status           String           @default("PENDING")
  approvedAt       DateTime?
  approvedBy       Int?
  sentAt           DateTime?
  pdfUrl           String?
  details          Json?
  metadata         Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime
  User             User?            @relation(fields: [approvedBy], references: [id])
  AffiliateProfile AffiliateProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, period])
  @@index([approvedAt])
  @@index([profileId, period])
  @@index([status, period])
}

model AffiliateProduct {
  id                      Int                       @id @default(autoincrement())
  productCode             String
  cruiseProductId         Int?
  title                   String
  status                  String                    @default("active")
  currency                String                    @default("KRW")
  defaultSaleAmount       Int?
  defaultCostAmount       Int?
  defaultNetRevenue       Int?
  metadata                Json?
  isPublished             Boolean                   @default(true)
  publishedAt             DateTime?
  effectiveFrom           DateTime
  effectiveTo             DateTime?
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime
  AffiliateCommissionTier AffiliateCommissionTier[]
  AffiliateLink           AffiliateLink[]
  CruiseProduct           CruiseProduct?            @relation(fields: [cruiseProductId], references: [id])
  AffiliateSale           AffiliateSale[]

  @@unique([productCode, effectiveFrom])
  @@index([isPublished])
  @@index([status])
}

model AffiliateProfile {
  id                                                              Int                    @id @default(autoincrement())
  userId                                                          Int                    @unique
  affiliateCode                                                   String                 @unique
  type                                                            String
  status                                                          String                 @default("DRAFT")
  displayName                                                     String?
  branchLabel                                                     String?
  nickname                                                        String?
  profileTitle                                                    String?
  bio                                                             String?
  profileImage                                                    String?
  coverImage                                                      String?
  contactPhone                                                    String?
  contactEmail                                                    String?
  kakaoLink                                                       String?
  instagramHandle                                                 String?
  youtubeChannel                                                  String?
  homepageUrl                                                     String?
  threadLink                                                      String?
  blogLink                                                        String?
  customLinks                                                     Json?
  galleryImages                                                   Json?
  featuredImages                                                  Json?
  youtubeVideoUrl                                                 String?
  littlyLinkSlug                                                  String?                @unique
  landingSlug                                                     String?                @unique
  landingTheme                                                    Json?
  landingAnnouncement                                             String?
  welcomeMessage                                                  String?
  externalLinks                                                   Json?
  published                                                       Boolean                @default(true)
  publishedAt                                                     DateTime?
  bankName                                                        String?
  bankAccount                                                     String?
  bankAccountHolder                                               String?
  withholdingRate                                                 Float                  @default(3.3)
  contractStatus                                                  String                 @default("DRAFT")
  contractSignedAt                                                DateTime?
  kycCompletedAt                                                  DateTime?
  onboardedAt                                                     DateTime?
  metadata                                                        Json?
  createdAt                                                       DateTime               @default(now())
  updatedAt                                                       DateTime
  schedules                                                       Json?
  AffiliateAuditLog                                               AffiliateAuditLog[]
  AffiliateContract                                               AffiliateContract[]
  AffiliateDocument                                               AffiliateDocument[]
  AffiliateInteraction                                            AffiliateInteraction[]
  AffiliateLead_AffiliateLead_agentIdToAffiliateProfile           AffiliateLead[]        @relation("AffiliateLead_agentIdToAffiliateProfile")
  AffiliateLead_AffiliateLead_managerIdToAffiliateProfile         AffiliateLead[]        @relation("AffiliateLead_managerIdToAffiliateProfile")
  AffiliateLead_AffiliateLead_sharedToManagerIdToAffiliateProfile AffiliateLead[]        @relation("AffiliateLead_sharedToManagerIdToAffiliateProfile")
  AffiliateLedger                                                 AffiliateLedger[]
  AffiliateLink_AffiliateLink_agentIdToAffiliateProfile           AffiliateLink[]        @relation("AffiliateLink_agentIdToAffiliateProfile")
  AffiliateLink_AffiliateLink_managerIdToAffiliateProfile         AffiliateLink[]        @relation("AffiliateLink_managerIdToAffiliateProfile")
  AffiliatePayslip                                                AffiliatePayslip[]
  User                                                            User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile   AffiliateRelation[]    @relation("AffiliateRelation_agentIdToAffiliateProfile")
  AffiliateRelation_AffiliateRelation_managerIdToAffiliateProfile AffiliateRelation[]    @relation("AffiliateRelation_managerIdToAffiliateProfile")
  AffiliateSale_AffiliateSale_agentIdToAffiliateProfile           AffiliateSale[]        @relation("AffiliateSale_agentIdToAffiliateProfile")
  AffiliateSale_AffiliateSale_managerIdToAffiliateProfile         AffiliateSale[]        @relation("AffiliateSale_managerIdToAffiliateProfile")
  AffiliateSmsConfig                                              AffiliateSmsConfig?
  CommissionLedger                                                CommissionLedger[]
  CustomerGroup                                                   CustomerGroup[]
  PartnerCustomerGroup                                            PartnerCustomerGroup[]
  PartnerSmsConfig                                                PartnerSmsConfig?
  SharedLandingPage                                               SharedLandingPage[]

  @@index([displayName])
  @@index([nickname])
  @@index([type, status])
}

model AffiliateRelation {
  id                                                             Int              @id @default(autoincrement())
  managerId                                                      Int
  agentId                                                        Int
  status                                                         String           @default("ACTIVE")
  connectedAt                                                    DateTime?
  disconnectedAt                                                 DateTime?
  notes                                                          String?
  metadata                                                       Json?
  createdAt                                                      DateTime         @default(now())
  updatedAt                                                      DateTime
  AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile   AffiliateProfile @relation("AffiliateRelation_agentIdToAffiliateProfile", fields: [agentId], references: [id], onDelete: Cascade)
  AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile AffiliateProfile @relation("AffiliateRelation_managerIdToAffiliateProfile", fields: [managerId], references: [id], onDelete: Cascade)

  @@unique([managerId, agentId])
  @@index([agentId, status])
}

model AffiliateSale {
  id                                                         Int                 @id @default(autoincrement())
  externalOrderCode                                          String?             @unique
  linkId                                                     Int?
  leadId                                                     Int?
  affiliateProductId                                         Int?
  managerId                                                  Int?
  agentId                                                    Int?
  productCode                                                String?
  cabinType                                                  String?
  fareCategory                                               String?
  headcount                                                  Int?
  saleAmount                                                 Int
  costAmount                                                 Int?
  netRevenue                                                 Int?
  branchCommission                                           Int?
  salesCommission                                            Int?
  overrideCommission                                         Int?
  withholdingAmount                                          Int?
  status                                                     String              @default("PENDING")
  saleDate                                                   DateTime?
  confirmedAt                                                DateTime?
  refundedAt                                                 DateTime?
  cancellationReason                                         String?
  audioFileGoogleDriveId                                     String?
  audioFileGoogleDriveUrl                                    String?
  audioFileName                                              String?
  audioFileType                                              String?
  submittedById                                              Int?
  submittedAt                                                DateTime?
  approvedById                                               Int?
  approvedAt                                                 DateTime?
  rejectedById                                               Int?
  rejectedAt                                                 DateTime?
  rejectionReason                                            String?
  metadata                                                   Json?
  createdAt                                                  DateTime            @default(now())
  updatedAt                                                  DateTime
  audioFileServerPath                                        String?
  AffiliateAuditLog                                          AffiliateAuditLog[]
  AffiliateLedger                                            AffiliateLedger[]
  AffiliateProduct                                           AffiliateProduct?   @relation(fields: [affiliateProductId], references: [id])
  AffiliateProfile_AffiliateSale_agentIdToAffiliateProfile   AffiliateProfile?   @relation("AffiliateSale_agentIdToAffiliateProfile", fields: [agentId], references: [id])
  AffiliateLead                                              AffiliateLead?      @relation(fields: [leadId], references: [id])
  AffiliateLink                                              AffiliateLink?      @relation(fields: [linkId], references: [id])
  AffiliateProfile_AffiliateSale_managerIdToAffiliateProfile AffiliateProfile?   @relation("AffiliateSale_managerIdToAffiliateProfile", fields: [managerId], references: [id])
  CommissionLedger                                           CommissionLedger[]
  DocumentApproval                                           DocumentApproval[]
  Payment                                                    Payment?
  Reservation                                                Reservation[]

  @@index([agentId, createdAt])
  @@index([agentId])
  @@index([agentId, saleDate])
  @@index([agentId, status, saleDate])
  @@index([createdAt])
  @@index([leadId, status])
  @@index([managerId, createdAt])
  @@index([managerId])
  @@index([managerId, saleDate])
  @@index([managerId, status, saleDate])
  @@index([saleDate])
  @@index([saleDate, status, createdAt])
  @@index([status, createdAt])
  @@index([status])
}

model AffiliateSmsConfig {
  id               Int              @id @default(autoincrement())
  profileId        Int              @unique
  provider         String           @default("aligo")
  apiKey           String
  userId           String
  senderPhone      String
  kakaoSenderKey   String?
  kakaoChannelId   String?
  isActive         Boolean          @default(true)
  metadata         Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime
  AffiliateProfile AffiliateProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, isActive])
}

model ApisSyncQueue {
  id          Int       @id @default(autoincrement())
  targetType  String
  targetId    Int
  status      String    @default("PENDING")
  attempts    Int       @default(0)
  lastError   String?
  scheduledAt DateTime  @default(now())
  createdAt   DateTime  @default(now())
  processedAt DateTime?

  @@index([status, scheduledAt])
}

model CertificateApproval {
  id                                         Int       @id @default(autoincrement())
  certificateType                            String
  requesterId                                Int
  requesterType                              String
  customerId                                 Int
  customerName                               String
  customerEmail                              String?
  birthDate                                  String?
  productName                                String
  paymentAmount                              Int
  paymentDate                                String
  refundAmount                               Int?
  refundDate                                 String?
  status                                     String    @default("pending")
  approvedBy                                 Int?
  approvedByType                             String?
  approvedAt                                 DateTime?
  rejectedReason                             String?
  metadata                                   Json?
  createdAt                                  DateTime  @default(now())
  updatedAt                                  DateTime
  User_CertificateApproval_approvedByToUser  User?     @relation("CertificateApproval_approvedByToUser", fields: [approvedBy], references: [id])
  User_CertificateApproval_customerIdToUser  User      @relation("CertificateApproval_customerIdToUser", fields: [customerId], references: [id])
  User_CertificateApproval_requesterIdToUser User      @relation("CertificateApproval_requesterIdToUser", fields: [requesterId], references: [id])

  @@index([approvedBy, createdAt])
  @@index([customerId, certificateType])
  @@index([requesterId, status, createdAt])
  @@index([status, createdAt])
}

model ChatBotFlow {
  id              Int               @id @default(autoincrement())
  name            String
  category        String            @default("AI 지니 채팅봇(구매)")
  description     String?
  startQuestionId Int?
  finalPageUrl    String?
  isActive        Boolean           @default(true)
  order           Int               @default(0)
  productCode     String?
  shareToken      String?           @unique
  isPublic        Boolean           @default(false)
  isTemplate      Boolean           @default(false)
  createdBy       Int?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime
  ChatBotQuestion ChatBotQuestion[]
  ChatBotSession  ChatBotSession[]

  @@index([category, isActive])
  @@index([isTemplate])
  @@index([order])
  @@index([productCode])
  @@index([productCode, isActive])
  @@index([shareToken])
}

model ChatBotQuestion {
  id              Int               @id @default(autoincrement())
  flowId          Int
  questionText    String
  questionType    String            @default("choice")
  spinType        String?
  information     String?
  optionA         String?
  optionB         String?
  options         Json?
  nextQuestionIdA Int?
  nextQuestionIdB Int?
  nextQuestionIds Json?
  order           Int               @default(0)
  isActive        Boolean           @default(true)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime
  ChatBotFlow     ChatBotFlow       @relation(fields: [flowId], references: [id], onDelete: Cascade)
  ChatBotResponse ChatBotResponse[]

  @@index([flowId, order])
  @@index([nextQuestionIdA])
  @@index([nextQuestionIdB])
}

model ChatBotResponse {
  id              Int             @id @default(autoincrement())
  sessionId       String
  questionId      Int
  selectedOption  String?
  selectedText    String?
  responseTime    Int?
  isAbandoned     Boolean         @default(false)
  nextQuestionId  Int?
  questionOrder   Int?
  optionLabel     String?
  displayedAt     DateTime?
  answeredAt      DateTime?       @default(now())
  createdAt       DateTime        @default(now())
  ChatBotQuestion ChatBotQuestion @relation(fields: [questionId], references: [id])
  ChatBotSession  ChatBotSession  @relation(fields: [sessionId], references: [sessionId], onDelete: Cascade)

  @@index([isAbandoned])
  @@index([questionId])
  @@index([questionOrder])
  @@index([sessionId, createdAt])
}

model ChatBotSession {
  id                 Int               @id @default(autoincrement())
  sessionId          String            @unique
  flowId             Int
  userId             Int?
  userPhone          String?
  userEmail          String?
  productCode        String?
  startedAt          DateTime          @default(now())
  completedAt        DateTime?
  endedAt            DateTime?
  durationMs         Int?
  isCompleted        Boolean           @default(false)
  finalStatus        String            @default("ONGOING")
  finalPageUrl       String?
  paymentStatus      String?
  paymentAttemptedAt DateTime?
  paymentCompletedAt DateTime?
  paymentOrderId     String?
  conversionRate     Float?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime
  ChatBotResponse    ChatBotResponse[]
  ChatBotFlow        ChatBotFlow       @relation(fields: [flowId], references: [id])
  User               User?             @relation(fields: [userId], references: [id])

  @@index([finalStatus])
  @@index([flowId, startedAt])
  @@index([isCompleted])
  @@index([paymentStatus])
  @@index([sessionId])
  @@index([userId])
}

model ChatHistory {
  id        Int       @id @default(autoincrement())
  userId    Int
  tripId    Int?
  sessionId String
  messages  Json
  createdAt DateTime  @default(now())
  updatedAt DateTime
  UserTrip  UserTrip? @relation(fields: [tripId], references: [id])
  User      User      @relation(fields: [userId], references: [id])

  @@index([userId, tripId, createdAt])
}

model ChecklistItem {
  id         Int       @id @default(autoincrement())
  userId     Int
  tripId     Int?
  text       String
  completed  Boolean   @default(false)
  order      Int       @default(0)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime
  userTripId Int?
  Trip       Trip?     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  UserTrip   UserTrip? @relation(fields: [userTripId], references: [id])

  @@index([order])
  @@index([userId, tripId])
}

model CmsNotificationTemplate {
  id          Int      @id @default(autoincrement())
  triggerCode String   @unique
  title       String
  message     String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@index([triggerCode, isActive])
}

model CommissionAdjustment {
  id                                            Int              @id @default(autoincrement())
  ledgerId                                      Int
  requestedById                                 Int
  approvedById                                  Int?
  status                                        String           @default("REQUESTED")
  amount                                        Int
  reason                                        String
  metadata                                      Json?
  requestedAt                                   DateTime         @default(now())
  decidedAt                                     DateTime?
  User_CommissionAdjustment_approvedByIdToUser  User?            @relation("CommissionAdjustment_approvedByIdToUser", fields: [approvedById], references: [id])
  CommissionLedger                              CommissionLedger @relation(fields: [ledgerId], references: [id], onDelete: Cascade)
  User_CommissionAdjustment_requestedByIdToUser User             @relation("CommissionAdjustment_requestedByIdToUser", fields: [requestedById], references: [id], onDelete: Cascade)
}

model CommissionLedger {
  id                   Int                    @id @default(autoincrement())
  saleId               Int
  profileId            Int?
  entryType            String
  amount               Int
  currency             String                 @default("KRW")
  withholdingAmount    Int?
  settlementId         Int?
  isSettled            Boolean                @default(false)
  notes                String?
  metadata             Json?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime
  CommissionAdjustment CommissionAdjustment[]
  AffiliateProfile     AffiliateProfile?      @relation(fields: [profileId], references: [id])
  AffiliateSale        AffiliateSale          @relation(fields: [saleId], references: [id], onDelete: Cascade)
  MonthlySettlement    MonthlySettlement?     @relation(fields: [settlementId], references: [id])

  @@unique([saleId, profileId, entryType])
  @@index([isSettled, createdAt])
  @@index([profileId, isSettled])
  @@index([saleId])
}

model CommunityComment {
  id                     Int                @id @default(autoincrement())
  postId                 Int
  userId                 Int?
  content                String
  authorName             String?
  parentCommentId        Int?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime
  CommunityComment       CommunityComment?  @relation("CommunityCommentToCommunityComment", fields: [parentCommentId], references: [id], onDelete: Cascade)
  other_CommunityComment CommunityComment[] @relation("CommunityCommentToCommunityComment")
  CommunityPost          CommunityPost      @relation(fields: [postId], references: [id], onDelete: Cascade)
  User                   User?              @relation(fields: [userId], references: [id])

  @@index([parentCommentId])
  @@index([postId, createdAt])
  @@index([userId])
}

model CommunityPost {
  id               Int                @id @default(autoincrement())
  userId           Int?
  title            String
  content          String
  category         String             @default("general")
  authorName       String?
  images           Json?
  views            Int                @default(0)
  likes            Int                @default(0)
  comments         Int                @default(0)
  isDeleted        Boolean            @default(false)
  deletedAt        DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime
  CommunityComment CommunityComment[]
  User             User?              @relation(fields: [userId], references: [id])

  @@index([category, isDeleted])
  @@index([createdAt])
  @@index([isDeleted, createdAt])
  @@index([userId])
}

model CruiseProduct {
  id                 Int                 @id @default(autoincrement())
  productCode        String              @unique
  cruiseLine         String
  shipName           String
  packageName        String
  nights             Int
  days               Int
  itineraryPattern   Json
  basePrice          Int?
  description        String?
  source             String?
  category           String?
  tags               Json?
  isPopular          Boolean             @default(false)
  isRecommended      Boolean             @default(false)
  isPremium          Boolean             @default(false)
  isGeniePack        Boolean             @default(false)
  isDomestic         Boolean             @default(false)
  isJapan            Boolean             @default(false)
  isBudget           Boolean             @default(false)
  isUrgent           Boolean             @default(false)
  isMainProduct      Boolean             @default(false)
  saleStatus         String              @default("판매중")
  startDate          DateTime?
  endDate            DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime
  AffiliateProduct   AffiliateProduct[]
  MallProductContent MallProductContent?
  ProductInquiry     ProductInquiry[]
  ProductView        ProductView[]
  UserTrip           UserTrip[]

  @@index([category])
  @@index([isBudget])
  @@index([isDomestic])
  @@index([isGeniePack])
  @@index([isJapan])
  @@index([isMainProduct])
  @@index([isPopular])
  @@index([isPremium])
  @@index([isRecommended])
  @@index([isUrgent])
  @@index([productCode])
  @@index([saleStatus])
  @@index([source])
}

model CruiseReview {
  id          Int       @id @default(autoincrement())
  userId      Int?
  productCode String?
  authorName  String
  rating      Int
  title       String?
  content     String
  images      Json?
  cruiseLine  String?
  shipName    String?
  travelDate  DateTime?
  isApproved  Boolean   @default(false)
  isDeleted   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  User        User?     @relation(fields: [userId], references: [id])

  @@index([createdAt])
  @@index([productCode, isApproved, isDeleted])
  @@index([rating, isApproved, isDeleted])
  @@index([userId])
}

model CustomerGroup {
  id                  Int                   @id @default(autoincrement())
  adminId             Int
  name                String
  description         String?
  color               String?
  parentGroupId       Int?
  affiliateProfileId  Int?
  funnelTalkIds       Json?
  funnelSmsIds        Json?
  funnelEmailIds      Json?
  reEntryHandling     String?
  autoMoveEnabled     Boolean               @default(false)
  autoMoveSettings    Json?
  createdAt           DateTime              @default(now())
  updatedAt           DateTime
  User                User                  @relation(fields: [adminId], references: [id], onDelete: Cascade)
  AffiliateProfile    AffiliateProfile?     @relation(fields: [affiliateProfileId], references: [id])
  CustomerGroup       CustomerGroup?        @relation("CustomerGroupToCustomerGroup", fields: [parentGroupId], references: [id])
  other_CustomerGroup CustomerGroup[]       @relation("CustomerGroupToCustomerGroup")
  CustomerGroupMember CustomerGroupMember[]
  FunnelMessage       FunnelMessage[]
  LandingPage         LandingPage[]
  ScheduledMessage    ScheduledMessage[]

  @@index([adminId])
  @@index([affiliateProfileId])
  @@index([name])
  @@index([parentGroupId])
}

model CustomerGroupMember {
  id                                     Int           @id @default(autoincrement())
  groupId                                Int
  userId                                 Int
  addedAt                                DateTime      @default(now())
  releasedAt                             DateTime?
  addedBy                                Int?
  User_CustomerGroupMember_addedByToUser User?         @relation("CustomerGroupMember_addedByToUser", fields: [addedBy], references: [id])
  CustomerGroup                          CustomerGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  User_CustomerGroupMember_userIdToUser  User          @relation("CustomerGroupMember_userIdToUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([groupId])
  @@index([releasedAt])
  @@index([userId])
}

model CustomerJourney {
  id                 Int      @id @default(autoincrement())
  userId             Int
  fromGroup          String?
  toGroup            String
  triggerType        String
  triggerId          Int?
  triggerDescription String?
  metadata           Json?
  createdAt          DateTime @default(now())
  User               User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([toGroup, createdAt])
  @@index([triggerType, createdAt])
  @@index([userId, createdAt])
}

model CustomerNote {
  id                                 Int      @id @default(autoincrement())
  customerId                         Int
  createdBy                          Int
  createdByType                      String
  createdByName                      String?
  content                            String
  isInternal                         Boolean  @default(false)
  notifyTargets                      Json?
  metadata                           Json?
  createdAt                          DateTime @default(now())
  updatedAt                          DateTime
  User_CustomerNote_createdByToUser  User     @relation("CustomerNote_createdByToUser", fields: [createdBy], references: [id])
  User_CustomerNote_customerIdToUser User     @relation("CustomerNote_customerIdToUser", fields: [customerId], references: [id], onDelete: Cascade)

  @@index([createdByType, createdAt])
  @@index([createdBy, createdAt])
  @@index([customerId, createdAt])
}

model DashboardStats {
  id                        Int      @id @default(autoincrement())
  date                      DateTime @unique @default(now())
  totalUsers                Int      @default(0)
  activeUsers               Int      @default(0)
  hibernatedUsers           Int      @default(0)
  genieUsers                Int      @default(0)
  mallUsers                 Int      @default(0)
  totalTrips                Int      @default(0)
  upcomingTrips             Int      @default(0)
  inProgressTrips           Int      @default(0)
  completedTrips            Int      @default(0)
  avgSatisfaction           Float    @default(0)
  reviewCount               Int      @default(0)
  totalNotifications        Int      @default(0)
  totalProducts             Int      @default(0)
  pwaGenieInstalled         Int      @default(0)
  pwaMallInstalled          Int      @default(0)
  pwaBothInstalled          Int      @default(0)
  totalBranchManagers       Int      @default(0)
  totalSalesAgents          Int      @default(0)
  totalAffiliateLeads       Int      @default(0)
  totalAffiliateSales       Int      @default(0)
  totalAffiliateSalesAmount Int      @default(0)
  totalCommissionPending    Int      @default(0)
  totalCommissionSettled    Int      @default(0)
  trends                    Json?
  productViews              Json?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime

  @@index([date])
}

model DocumentApproval {
  id                                      Int            @id @default(autoincrement())
  type                                    String
  requesterId                             Int
  saleId                                  Int
  leadId                                  Int?
  status                                  String         @default("PENDING")
  requestData                             Json?
  adminNotes                              String?
  approvedBy                              Int?
  createdAt                               DateTime       @default(now())
  processedAt                             DateTime?
  User_DocumentApproval_approvedByToUser  User?          @relation("DocumentApproval_approvedByToUser", fields: [approvedBy], references: [id])
  AffiliateLead                           AffiliateLead? @relation(fields: [leadId], references: [id])
  User_DocumentApproval_requesterIdToUser User           @relation("DocumentApproval_requesterIdToUser", fields: [requesterId], references: [id])
  AffiliateSale                           AffiliateSale  @relation(fields: [saleId], references: [id])

  @@index([requesterId, status])
  @@index([saleId])
  @@index([status, createdAt])
}

model EmailAddressBook {
  id        Int      @id @default(autoincrement())
  adminId   Int
  name      String?
  email     String
  phone     String?
  memo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime
  User      User     @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@unique([adminId, email])
  @@index([adminId, createdAt])
  @@index([email])
}

model Expense {
  id            Int      @id @default(autoincrement())
  userId        Int
  description   String
  category      String
  foreignAmount Float
  krwAmount     Float
  usdAmount     Float
  currency      String
  createdAt     DateTime @default(now())
  updatedAt     DateTime
  userTripId    Int
  UserTrip      UserTrip @relation(fields: [userTripId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId, userTripId])
}

model FeatureUsage {
  id         Int      @id @default(autoincrement())
  userId     Int
  feature    String
  usageCount Int      @default(1)
  lastUsedAt DateTime @default(now())
  createdAt  DateTime @default(now())
  updatedAt  DateTime
  User       User     @relation(fields: [userId], references: [id])

  @@unique([userId, feature])
  @@index([feature, usageCount])
  @@index([lastUsedAt])
  @@index([userId, lastUsedAt])
}

model FunnelConversion {
  id                Int                @id @default(autoincrement())
  funnelId          Int
  customerId        Int?
  conversionType    String
  conversionValue   Float?
  conversionStage   String?
  metadata          Json?
  convertedAt       DateTime           @default(now())
  MarketingCustomer MarketingCustomer? @relation(fields: [customerId], references: [id])
  MarketingFunnel   MarketingFunnel    @relation(fields: [funnelId], references: [id], onDelete: Cascade)

  @@index([conversionType, convertedAt])
  @@index([customerId, convertedAt])
  @@index([funnelId, convertedAt])
}

model FunnelMessage {
  id                 Int                  @id @default(autoincrement())
  adminId            Int
  groupId            Int?
  messageType        String
  title              String
  category           String?
  groupName          String?
  description        String?
  senderPhone        String?
  senderEmail        String?
  sendTime           String?
  optOutNumber       String?
  autoAddOptOut      Boolean              @default(true)
  isActive           Boolean              @default(true)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime
  User               User                 @relation(fields: [adminId], references: [id])
  CustomerGroup      CustomerGroup?       @relation(fields: [groupId], references: [id])
  FunnelMessageStage FunnelMessageStage[]

  @@index([adminId, createdAt])
  @@index([groupId])
  @@index([messageType, isActive])
}

model FunnelMessageStage {
  id              Int           @id @default(autoincrement())
  funnelMessageId Int
  stageNumber     Int
  daysAfter       Int           @default(0)
  sendTime        String?
  content         String
  imageUrl        String?
  order           Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime
  FunnelMessage   FunnelMessage @relation(fields: [funnelMessageId], references: [id], onDelete: Cascade)

  @@index([funnelMessageId, order])
  @@index([funnelMessageId, stageNumber])
}

model FunnelStage {
  id               Int             @id @default(autoincrement())
  funnelId         Int
  stageName        String
  stageOrder       Int
  stageType        String
  triggerCondition Json?
  actionType       String?
  actionContent    Json?
  delayDays        Int?            @default(0)
  isActive         Boolean         @default(true)
  metadata         Json?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime
  MarketingFunnel  MarketingFunnel @relation(fields: [funnelId], references: [id], onDelete: Cascade)

  @@index([funnelId, isActive])
  @@index([funnelId, stageOrder])
}

model Itinerary {
  id          Int       @id @default(autoincrement())
  day         Int
  date        DateTime
  type        String
  location    String?
  country     String?
  currency    String?
  language    String?
  arrival     String?
  departure   String?
  time        String?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  allAboardAt DateTime?
  arrivalAt   DateTime?
  portLat     Float?
  portLng     Float?
  userTripId  Int
  UserTrip    UserTrip  @relation(fields: [userTripId], references: [id], onDelete: Cascade)

  @@index([date])
  @@index([userTripId, day])
}

model ItineraryGroup {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  itinerary   Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@index([name])
}

model KnowledgeBase {
  id                 Int       @id @default(autoincrement())
  category           String
  question           String?
  title              String
  content            String
  keywords           String
  metadata           Json?
  language           String    @default("ko")
  priority           Int       @default(0)
  isActive           Boolean   @default(true)
  embedding          Json?
  embeddingUpdatedAt DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime

  @@index([category, isActive])
  @@index([keywords])
}

model LandingPage {
  id                      Int                       @id @default(autoincrement())
  adminId                 Int
  title                   String
  exposureTitle           String?
  category                String?
  pageGroup               String?
  description             String?
  htmlContent             String
  headerScript            String?
  businessInfo            Json?
  exposureImage           String?
  attachmentFile          String?
  viewCount               Int                       @default(0)
  slug                    String                    @unique
  shortcutUrl             String?                   @unique
  isActive                Boolean                   @default(true)
  isPublic                Boolean                   @default(true)
  marketingAccountId      Int?
  marketingFunnelId       Int?
  funnelOrder             Int?
  groupId                 Int?
  additionalGroupId       Int?
  checkDuplicateGroup     Boolean                   @default(false)
  inputLimit              String                    @default("무제한 허용")
  completionPageUrl       String?
  buttonTitle             String                    @default("신청하기")
  smsNotification         Boolean                   @default(false)
  commentEnabled          Boolean                   @default(false)
  infoCollection          Boolean                   @default(false)
  scheduledMessageId      Int?
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime
  User                    User                      @relation(fields: [adminId], references: [id], onDelete: Cascade)
  CustomerGroup           CustomerGroup?            @relation(fields: [groupId], references: [id])
  MarketingAccount        MarketingAccount?         @relation(fields: [marketingAccountId], references: [id])
  MarketingFunnel         MarketingFunnel?          @relation(fields: [marketingFunnelId], references: [id])
  ScheduledMessage        ScheduledMessage?         @relation(fields: [scheduledMessageId], references: [id])
  LandingPageComment      LandingPageComment[]
  LandingPageFunnel       LandingPageFunnel[]
  LandingPageRegistration LandingPageRegistration[]
  LandingPageView         LandingPageView[]
  SharedLandingPage       SharedLandingPage[]

  @@index([adminId])
  @@index([category])
  @@index([groupId])
  @@index([isActive])
  @@index([isPublic])
  @@index([marketingAccountId])
  @@index([marketingFunnelId, funnelOrder])
  @@index([pageGroup])
  @@index([slug])
}

model LandingPageComment {
  id              Int         @id @default(autoincrement())
  landingPageId   Int
  authorName      String
  content         String
  password        String?
  createdAt       DateTime
  isAutoGenerated Boolean     @default(true)
  metadata        Json?
  LandingPage     LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([landingPageId, createdAt])
}

model LandingPageFunnel {
  id            Int         @id @default(autoincrement())
  landingPageId Int
  userId        Int?
  userPhone     String?
  funnelName    String
  startTime     DateTime    @default(now())
  endTime       DateTime?
  duration      Int?
  pagesViewed   Json?
  metadata      Json?
  LandingPage   LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  User          User?       @relation(fields: [userId], references: [id])

  @@index([funnelName])
  @@index([landingPageId, startTime])
  @@index([userId, startTime])
  @@index([userPhone])
}

model LandingPageRegistration {
  id            Int         @id @default(autoincrement())
  landingPageId Int
  userId        Int?
  customerName  String
  customerGroup String?
  phone         String
  email         String?
  customFields  Json?
  metadata      Json?
  registeredAt  DateTime    @default(now())
  deletedAt     DateTime?
  LandingPage   LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  User          User?       @relation(fields: [userId], references: [id])

  @@index([customerGroup])
  @@index([landingPageId, registeredAt])
  @@index([phone])
  @@index([registeredAt])
  @@index([userId])
}

model LandingPageView {
  id            Int         @id @default(autoincrement())
  landingPageId Int
  userId        Int?
  userPhone     String?
  userEmail     String?
  ipAddress     String?
  userAgent     String?
  referer       String?
  viewedAt      DateTime    @default(now())
  duration      Int?
  LandingPage   LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  User          User?       @relation(fields: [userId], references: [id])

  @@index([landingPageId, viewedAt])
  @@index([userId, viewedAt])
  @@index([userPhone])
}

model LeadInteraction {
  id                 Int           @id @default(autoincrement())
  leadId             Int
  interactionType    String
  interactionContent Json?
  result             String?
  notes              String?
  occurredAt         DateTime      @default(now())
  metadata           Json?
  MarketingLead      MarketingLead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([interactionType, occurredAt])
  @@index([leadId, occurredAt])
}

model LeadScore {
  id                Int                @id @default(autoincrement())
  accountId         Int
  customerId        Int?
  leadId            Int?
  score             Int                @default(0)
  scoreBreakdown    Json?
  lastCalculatedAt  DateTime           @default(now())
  metadata          Json?
  MarketingAccount  MarketingAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  MarketingCustomer MarketingCustomer? @relation(fields: [customerId], references: [id])
  MarketingLead     MarketingLead?     @relation(fields: [leadId], references: [id])

  @@index([accountId, score])
  @@index([customerId])
  @@index([lastCalculatedAt])
  @@index([leadId])
}

model LoginLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  kind      String
  message   String?
  meta      Json?
  createdAt DateTime @default(now())
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model MallContent {
  id        Int      @id @default(autoincrement())
  section   String
  key       String
  type      String
  content   Json
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime

  @@unique([section, key])
  @@index([order])
  @@index([section, isActive])
}

model MallProductContent {
  id            Int           @id @default(autoincrement())
  productCode   String        @unique
  thumbnail     String?
  images        Json?
  videos        Json?
  fonts         Json?
  layout        Json?
  customCss     String?
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime
  CruiseProduct CruiseProduct @relation(fields: [productCode], references: [productCode], onDelete: Cascade)

  @@index([productCode, isActive])
}

model MapTravelRecord {
  id          Int      @id @default(autoincrement())
  userId      Int
  cruiseName  String
  companion   String
  destination String
  startDate   DateTime
  endDate     DateTime
  impressions String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now())
  User        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([startDate])
  @@index([userId, createdAt])
}

model MarketingAccount {
  id                    Int                 @id @default(autoincrement())
  accountName           String
  accountCode           String              @unique
  ownerId               Int
  status                String              @default("ACTIVE")
  maxCustomers          Int                 @default(99000)
  maxPages              Int                 @default(3000)
  maxFunnels            Int                 @default(300)
  currentCustomerCount  Int                 @default(0)
  currentPageCount      Int                 @default(0)
  currentFunnelCount    Int                 @default(0)
  subscriptionPlan      String              @default("UNLIMITED")
  subscriptionExpiresAt DateTime?
  metadata              Json?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime
  LandingPage           LandingPage[]
  LeadScore             LeadScore[]
  User                  User                @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  MarketingCustomer     MarketingCustomer[]
  MarketingFunnel       MarketingFunnel[]
  MarketingLead         MarketingLead[]
  ViralLoop             ViralLoop[]

  @@index([accountCode])
  @@index([ownerId])
  @@index([status])
}

model MarketingConfig {
  id                  Int      @id @default(autoincrement())
  googlePixelId       String?
  googleTagManagerId  String?
  googleAdsId         String?
  googleApiKey        String?
  googleTestMode      Boolean  @default(false)
  facebookPixelId     String?
  facebookAppId       String?
  facebookAccessToken String?
  facebookTestMode    Boolean  @default(false)
  naverPixelId        String?
  kakaoPixelId        String?
  isGoogleEnabled     Boolean  @default(false)
  isFacebookEnabled   Boolean  @default(false)
  isNaverEnabled      Boolean  @default(false)
  isKakaoEnabled      Boolean  @default(false)
  metadata            Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime

  @@index([isFacebookEnabled])
  @@index([isGoogleEnabled])
}

model MarketingCustomer {
  id                                                          Int                @id @default(autoincrement())
  accountId                                                   Int
  name                                                        String?
  email                                                       String?
  phone                                                       String?
  source                                                      String?
  status                                                      String             @default("NEW")
  leadScore                                                   Int                @default(0)
  tags                                                        Json?
  notes                                                       String?
  lastContactedAt                                             DateTime?
  convertedAt                                                 DateTime?
  metadata                                                    Json?
  createdAt                                                   DateTime           @default(now())
  updatedAt                                                   DateTime
  FunnelConversion                                            FunnelConversion[]
  LeadScore                                                   LeadScore[]
  MarketingAccount                                            MarketingAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  MarketingLead                                               MarketingLead[]
  RepeatPurchase                                              RepeatPurchase?
  ViralLoop_ViralLoop_customerIdToMarketingCustomer           ViralLoop[]        @relation("ViralLoop_customerIdToMarketingCustomer")
  ViralLoop_ViralLoop_referredByCustomerIdToMarketingCustomer ViralLoop[]        @relation("ViralLoop_referredByCustomerIdToMarketingCustomer")

  @@index([accountId, createdAt])
  @@index([accountId, status])
  @@index([email])
  @@index([leadScore])
  @@index([phone])
  @@index([status, lastContactedAt])
}

model MarketingFunnel {
  id               Int                @id @default(autoincrement())
  accountId        Int
  funnelName       String
  description      String?
  funnelType       String             @default("SALES")
  status           String             @default("ACTIVE")
  stages           Json
  automationRules  Json?
  conversionGoal   String?
  conversionRate   Float?             @default(0)
  totalVisitors    Int                @default(0)
  totalConversions Int                @default(0)
  metadata         Json?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime
  FunnelConversion FunnelConversion[]
  FunnelStage      FunnelStage[]
  LandingPage      LandingPage[]
  MarketingAccount MarketingAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId, funnelType])
  @@index([accountId, status])
  @@index([funnelName])
}

model MarketingInsight {
  id          Int      @id @default(autoincrement())
  userId      Int
  insightType String
  data        Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime
  User        User     @relation(fields: [userId], references: [id])

  @@unique([userId, insightType])
  @@index([userId, insightType])
}

model MarketingLead {
  id                Int                @id @default(autoincrement())
  accountId         Int
  customerId        Int?
  source            String
  sourceDetail      String?
  name              String?
  email             String?
  phone             String?
  status            String             @default("NEW")
  leadScore         Int                @default(0)
  tags              Json?
  notes             String?
  metadata          Json?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime
  LeadInteraction   LeadInteraction[]
  LeadScore         LeadScore[]
  MarketingAccount  MarketingAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  MarketingCustomer MarketingCustomer? @relation(fields: [customerId], references: [id])

  @@index([accountId, createdAt])
  @@index([accountId, status])
  @@index([email])
  @@index([leadScore])
  @@index([phone])
}

model MeetingParticipant {
  id          Int         @id @default(autoincrement())
  roomId      Int
  userId      Int
  joinedAt    DateTime    @default(now())
  leftAt      DateTime?
  MeetingRoom MeetingRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  User        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([joinedAt])
  @@index([roomId])
  @@index([userId])
}

model MeetingRoom {
  id                   Int                  @id @default(autoincrement())
  roomId               String               @unique
  hostId               Int
  title                String
  description          String?
  password             String?
  maxParticipants      Int                  @default(10)
  isWaitingRoomEnabled Boolean              @default(false)
  isRecordingEnabled   Boolean              @default(false)
  scheduledStart       DateTime?
  scheduledEnd         DateTime?
  meetingLink          String?              @unique
  status               String               @default("ACTIVE")
  createdAt            DateTime             @default(now())
  updatedAt            DateTime
  endedAt              DateTime?
  MeetingParticipant   MeetingParticipant[]
  User                 User                 @relation(fields: [hostId], references: [id])

  @@index([hostId])
  @@index([meetingLink])
  @@index([roomId])
  @@index([scheduledStart])
  @@index([status, createdAt])
}

model MonthlySettlement {
  id               Int                @id @default(autoincrement())
  periodStart      DateTime
  periodEnd        DateTime
  targetRole       String?
  status           String             @default("DRAFT")
  approvedById     Int?
  approvedAt       DateTime?
  lockedAt         DateTime?
  paymentDate      DateTime?
  exportUrl        String?
  summary          Json?
  notes            String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime
  CommissionLedger CommissionLedger[]
  User             User?              @relation(fields: [approvedById], references: [id])
  SettlementEvent  SettlementEvent[]

  @@index([periodStart, periodEnd])
  @@index([status])
}

model NotificationLog {
  id               Int      @id @default(autoincrement())
  userId           Int
  tripId           Int?
  itineraryId      Int?
  notificationType String
  eventKey         String   @unique
  title            String
  body             String
  sentAt           DateTime @default(now())

  @@index([sentAt])
  @@index([userId, tripId])
}

model PageContent {
  id          Int      @id @default(autoincrement())
  pagePath    String
  section     String
  itemId      String?
  contentType String
  content     Json
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@unique([pagePath, section, itemId])
  @@index([order])
  @@index([pagePath])
  @@index([pagePath, section, isActive])
}

model PartnerCustomerGroup {
  id               Int               @id @default(autoincrement())
  name             String
  description      String?
  profileId        Int?
  productCode      String?
  color            String?
  funnelTalkIds    Json?
  funnelSmsIds     Json?
  funnelEmailIds   Json?
  reEntryHandling  String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime
  AffiliateLead    AffiliateLead[]
  AffiliateProfile AffiliateProfile? @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([productCode])
  @@index([profileId])
}

model PartnerSmsConfig {
  id               Int              @id @default(autoincrement())
  profileId        Int              @unique
  provider         String           @default("aligo")
  apiKey           String
  userId           String
  senderPhone      String
  kakaoSenderKey   String?
  kakaoChannelId   String?
  isActive         Boolean          @default(true)
  metadata         Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime
  AffiliateProfile AffiliateProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, isActive])
}

model PassportRequestLog {
  id                                    Int                      @id @default(autoincrement())
  userId                                Int
  adminId                               Int
  templateId                            Int?
  messageBody                           String
  messageChannel                        String                   @default("SMS")
  status                                String                   @default("PENDING")
  errorReason                           String?
  sentAt                                DateTime                 @default(now())
  User_PassportRequestLog_adminIdToUser User                     @relation("PassportRequestLog_adminIdToUser", fields: [adminId], references: [id])
  PassportRequestTemplate               PassportRequestTemplate? @relation(fields: [templateId], references: [id])
  User_PassportRequestLog_userIdToUser  User                     @relation("PassportRequestLog_userIdToUser", fields: [userId], references: [id])

  @@index([adminId, sentAt])
  @@index([status, sentAt])
  @@index([userId, sentAt])
}

model PassportRequestTemplate {
  id                 Int                  @id @default(autoincrement())
  title              String               @default("여권 제출 안내")
  body               String
  variables          Json?
  isDefault          Boolean              @default(false)
  updatedById        Int?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @default(now())
  PassportRequestLog PassportRequestLog[]
  User               User?                @relation(fields: [updatedById], references: [id])
}

model PassportSubmission {
  id                      Int                       @id @default(autoincrement())
  userId                  Int
  tripId                  Int?
  token                   String                    @unique
  tokenExpiresAt          DateTime
  isSubmitted             Boolean                   @default(false)
  submittedAt             DateTime?
  driveFolderUrl          String?
  extraData               Json?
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime
  UserTrip                UserTrip?                 @relation(fields: [tripId], references: [id])
  User                    User                      @relation(fields: [userId], references: [id])
  PassportSubmissionGuest PassportSubmissionGuest[]

  @@index([isSubmitted, updatedAt])
  @@index([tripId])
  @@index([userId])
}

model PassportSubmissionGuest {
  id                 Int                @id @default(autoincrement())
  submissionId       Int
  groupNumber        Int
  name               String
  phone              String?
  passportNumber     String?
  nationality        String?
  dateOfBirth        DateTime?
  passportExpiryDate DateTime?
  ocrRawData         Json?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime
  PassportSubmission PassportSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([name])
  @@index([submissionId, groupNumber])
}

model PasswordEvent {
  id        Int      @id @default(autoincrement())
  userId    Int
  from      String
  to        String
  reason    String
  createdAt DateTime @default(now())
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Payment {
  id                  Int            @id @default(autoincrement())
  orderId             String         @unique
  productCode         String?
  productName         String?
  amount              Int
  currency            String         @default("KRW")
  buyerName           String
  buyerEmail          String?
  buyerTel            String
  status              String         @default("pending")
  pgProvider          String?
  pgTransactionId     String?
  pgMid               String?
  affiliateCode       String?
  affiliateMallUserId String?
  paidAt              DateTime?
  failedAt            DateTime?
  cancelledAt         DateTime?
  failureReason       String?
  metadata            Json?
  saleId              Int?           @unique
  createdAt           DateTime       @default(now())
  updatedAt           DateTime
  AffiliateSale       AffiliateSale? @relation(fields: [saleId], references: [id])

  @@index([affiliateCode])
  @@index([buyerTel])
  @@index([orderId])
  @@index([pgTransactionId])
  @@index([status, createdAt])
}

model ProductInquiry {
  id             Int           @id @default(autoincrement())
  productCode    String
  userId         Int?
  name           String
  phone          String
  passportNumber String?
  message        String?
  status         String        @default("pending")
  createdAt      DateTime      @default(now())
  updatedAt      DateTime
  CruiseProduct  CruiseProduct @relation(fields: [productCode], references: [productCode], onDelete: Cascade)
  User           User?         @relation(fields: [userId], references: [id])

  @@index([createdAt])
  @@index([productCode])
  @@index([status])
  @@index([userId])
}

model ProductView {
  id            Int           @id @default(autoincrement())
  productCode   String
  userId        Int?
  viewedAt      DateTime      @default(now())
  CruiseProduct CruiseProduct @relation(fields: [productCode], references: [productCode], onDelete: Cascade)
  User          User?         @relation(fields: [userId], references: [id])

  @@index([productCode, viewedAt])
  @@index([userId, viewedAt])
  @@index([viewedAt])
}

model Prospect {
  id        Int      @id @default(autoincrement())
  name      String?
  email     String?
  phone     String?
  source    String?
  notes     String?
  tags      Json?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime

  @@index([createdAt])
  @@index([email])
  @@index([isActive])
  @@index([phone])
}

model PushSubscription {
  id        Int      @id @default(autoincrement())
  userId    Int
  endpoint  String   @unique
  keys      Json
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model RePurchaseTrigger {
  id              Int       @id @default(autoincrement())
  userId          Int
  lastTripEndDate DateTime
  triggerType     String
  messageSent     Boolean   @default(false)
  converted       Boolean   @default(false)
  convertedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime
  User            User      @relation(fields: [userId], references: [id])

  @@index([converted, createdAt])
  @@index([userId, lastTripEndDate])
}

model RefundPolicyGroup {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@index([name])
}

model RepeatPurchase {
  id                    Int               @id @default(autoincrement())
  customerId            Int               @unique
  firstPurchaseAt       DateTime
  lastPurchaseAt        DateTime
  purchaseCount         Int               @default(1)
  totalPurchaseValue    Float             @default(0)
  averagePurchaseValue  Float             @default(0)
  daysSinceLastPurchase Int?
  isActive              Boolean           @default(true)
  metadata              Json?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime
  MarketingCustomer     MarketingCustomer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
  @@index([isActive, daysSinceLastPurchase])
  @@index([lastPurchaseAt])
}

model Reservation {
  id                Int            @id @default(autoincrement())
  tripId            Int
  mainUserId        Int
  totalPeople       Int
  cabinType         String?
  paymentDate       DateTime?
  paymentMethod     String?
  paymentAmount     Float?
  agentName         String?
  remarks           String?
  passportGroupLink String?
  passportStatus    String         @default("PENDING")
  affiliateSaleId   Int?
  createdAt         DateTime       @default(now())
  pnrStatus         String         @default("PENDING")
  status            String         @default("CONFIRMED")
  updatedAt         DateTime       @default(now()) @updatedAt
  AffiliateSale     AffiliateSale? @relation(fields: [affiliateSaleId], references: [id])
  User              User           @relation(fields: [mainUserId], references: [id])
  Trip              Trip           @relation(fields: [tripId], references: [id], onDelete: Cascade)
  Traveler          Traveler[]

  @@index([mainUserId])
  @@index([passportStatus])
  @@index([tripId])
  @@index([status])
  @@index([pnrStatus])
}

model ScheduledMessage {
  id                    Int                     @id @default(autoincrement())
  adminId               Int
  title                 String
  category              String                  @default("예약메시지")
  groupName             String?
  description           String?
  sendMethod            String
  senderName            String?
  senderPhone           String?
  senderEmail           String?
  optOutNumber          String?
  isAdMessage           Boolean                 @default(false)
  autoAddAdTag          Boolean                 @default(true)
  autoAddOptOut         Boolean                 @default(true)
  startDate             DateTime?
  startTime             String?
  maxDays               Int                     @default(99999)
  repeatInterval        Int?
  isActive              Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime
  metadata              Json?
  targetGroupId         Int?
  LandingPage           LandingPage[]
  User                  User                    @relation(fields: [adminId], references: [id])
  CustomerGroup         CustomerGroup?          @relation(fields: [targetGroupId], references: [id])
  ScheduledMessageLog   ScheduledMessageLog[]
  ScheduledMessageStage ScheduledMessageStage[]

  @@index([adminId, createdAt])
  @@index([category, isActive])
  @@index([startDate, isActive])
  @@index([targetGroupId])
}

model ScheduledMessageLog {
  id                 Int              @id @default(autoincrement())
  scheduledMessageId Int
  userId             Int
  stageNumber        Int
  sentAt             DateTime         @default(now())
  status             String           @default("sent")
  errorMessage       String?
  metadata           Json?
  ScheduledMessage   ScheduledMessage @relation(fields: [scheduledMessageId], references: [id], onDelete: Cascade)
  User               User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([scheduledMessageId, stageNumber])
  @@index([scheduledMessageId, userId])
  @@index([sentAt])
  @@index([userId, sentAt])
}

model ScheduledMessageStage {
  id                 Int              @id @default(autoincrement())
  scheduledMessageId Int
  stageNumber        Int
  daysAfter          Int              @default(0)
  sendTime           String?
  title              String
  content            String
  order              Int              @default(0)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime
  ScheduledMessage   ScheduledMessage @relation(fields: [scheduledMessageId], references: [id], onDelete: Cascade)

  @@index([scheduledMessageId, order])
  @@index([scheduledMessageId, stageNumber])
}

model SeoConfig {
  id                 Int      @id @default(autoincrement())
  pagePath           String   @unique
  pageType           String
  title              String?
  description        String?
  keywords           String?
  ogTitle            String?
  ogDescription      String?
  ogImage            String?
  ogType             String?  @default("website")
  ogUrl              String?
  twitterCard        String?  @default("summary_large_image")
  twitterTitle       String?
  twitterDescription String?
  twitterImage       String?
  structuredData     Json?
  canonicalUrl       String?
  robots             String?
  hreflang           Json?
  viewCount          Int      @default(0)
  lastUpdated        DateTime
  createdAt          DateTime @default(now())

  @@index([lastUpdated])
  @@index([pagePath])
  @@index([pageType])
}

model SeoGlobalConfig {
  id                              Int      @id @default(autoincrement())
  googleSearchConsoleVerification String?
  googleSearchConsolePropertyId   String?
  googleAnalyticsId               String?
  facebookUrl                     String?
  instagramUrl                    String?
  youtubeUrl                      String?
  twitterUrl                      String?
  naverBlogUrl                    String?
  kakaoChannelUrl                 String?
  defaultSiteName                 String?  @default("크루즈 가이드")
  defaultSiteDescription          String?
  defaultKeywords                 String?
  defaultOgImage                  String?
  contactPhone                    String?
  contactEmail                    String?
  contactAddress                  String?
  metadata                        Json?
  createdAt                       DateTime @default(now())
  updatedAt                       DateTime

  @@index([createdAt])
}

model Session {
  id        String    @id
  userId    Int
  createdAt DateTime  @default(now())
  csrfToken String?
  expiresAt DateTime?
  User      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([expiresAt])
}

model SettlementEvent {
  id                Int               @id @default(autoincrement())
  settlementId      Int
  userId            Int?
  eventType         String
  description       String?
  metadata          Json?
  createdAt         DateTime          @default(now())
  MonthlySettlement MonthlySettlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  User              User?             @relation(fields: [userId], references: [id])

  @@index([settlementId, createdAt])
}

model SharedLandingPage {
  id               Int              @id @default(autoincrement())
  landingPageId    Int
  managerProfileId Int
  category         String?          @default("관리자 보너스")
  createdAt        DateTime         @default(now())
  LandingPage      LandingPage      @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  AffiliateProfile AffiliateProfile @relation(fields: [managerProfileId], references: [id], onDelete: Cascade)

  @@unique([landingPageId, managerProfileId])
  @@index([managerProfileId])
}

model SystemConfig {
  id          Int      @id @default(autoincrement())
  configKey   String   @unique
  configValue String?
  description String?
  category    String   @default("general")
  isActive    Boolean  @default(true)
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  @@index([category])
  @@index([configKey])
}

model SystemConsultation {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String
  message   String?
  status    String   @default("NEW")
  managerId Int?
  agentId   Int?
  createdAt DateTime @default(now())
  updatedAt DateTime
  metadata  Json?

  @@index([agentId])
  @@index([createdAt])
  @@index([managerId])
}

model TravelDiaryEntry {
  id          Int      @id @default(autoincrement())
  userId      Int
  countryCode String
  countryName String
  title       String
  content     String
  visitDate   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime
  userTripId  Int
  User        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  UserTrip    UserTrip @relation(fields: [userTripId], references: [id], onDelete: Cascade)

  @@index([userId, countryCode])
  @@index([userId, userTripId])
  @@index([visitDate])
}

model Traveler {
  id             Int         @id @default(autoincrement())
  reservationId  Int
  roomNumber     Int
  isSingleCharge Boolean     @default(false)
  engSurname     String?
  engGivenName   String?
  korName        String?
  residentNum    String?
  gender         String?
  birthDate      String?
  passportNo     String?
  issueDate      String?
  expiryDate     String?
  passportImage  String?
  userId         Int?
  nationality    String?
  notes          String?
  phone          String?
  Reservation    Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  User           User?       @relation(fields: [userId], references: [id])

  @@index([reservationId])
  @@index([residentNum])
  @@index([userId])
}

model Trip {
  id               Int               @id @default(autoincrement())
  productCode      String            @unique
  shipName         String
  departureDate    DateTime
  googleFolderId   String?
  spreadsheetId    String?
  status           String            @default("Upcoming")
  endDate          DateTime?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @default(now())
  ChecklistItem    ChecklistItem[]
  Reservation      Reservation[]
  UserTripFeedback UserTripFeedback?

  @@index([departureDate])
  @@index([productCode])
  @@index([status])
}

model User {
  id                                                            Int                       @id @default(autoincrement())
  externalId                                                    String?                   @unique
  name                                                          String?
  email                                                         String?                   @unique
  phone                                                         String?
  password                                                      String
  onboarded                                                     Boolean                   @default(false)
  loginCount                                                    Int                       @default(0)
  tripCount                                                     Int                       @default(0)
  totalTripCount                                                Int                       @default(0)
  currentTripEndDate                                            DateTime?
  role                                                          String                    @default("user")
  onboardingUpdatedAt                                           DateTime?
  onboardingUpdatedByUser                                       Boolean                   @default(false)
  lastActiveAt                                                  DateTime?
  hibernatedAt                                                  DateTime?
  isHibernated                                                  Boolean                   @default(false)
  isLocked                                                      Boolean                   @default(false)
  lockedAt                                                      DateTime?
  lockedReason                                                  String?
  customerStatus                                                String?
  testModeStartedAt                                             DateTime?
  customerSource                                                String?
  adminMemo                                                     String?
  mallUserId                                                    String?
  mallNickname                                                  String?
  genieStatus                                                   String?
  genieLinkedAt                                                 DateTime?
  kakaoChannelAdded                                             Boolean                   @default(false)
  kakaoChannelAddedAt                                           DateTime?
  createdAt                                                     DateTime                  @default(now())
  updatedAt                                                     DateTime
  pwaGenieInstalledAt                                           DateTime?
  pwaMallInstalledAt                                            DateTime?
  refundCertificateCount                                        Int                       @default(0)
  AdminActionLog                                                AdminActionLog[]
  AdminMessage_AdminMessage_adminIdToUser                       AdminMessage[]            @relation("AdminMessage_adminIdToUser")
  AdminMessage_AdminMessage_userIdToUser                        AdminMessage[]            @relation("AdminMessage_userIdToUser")
  AdminNotification                                             AdminNotification[]
  AdminSmsConfig                                                AdminSmsConfig?
  AffiliateAuditLog                                             AffiliateAuditLog[]
  AffiliateContract_AffiliateContract_reviewerIdToUser          AffiliateContract[]       @relation("AffiliateContract_reviewerIdToUser")
  AffiliateContract_AffiliateContract_userIdToUser              AffiliateContract[]       @relation("AffiliateContract_userIdToUser")
  AffiliateDocument_AffiliateDocument_approvedByIdToUser        AffiliateDocument[]       @relation("AffiliateDocument_approvedByIdToUser")
  AffiliateDocument_AffiliateDocument_uploadedByIdToUser        AffiliateDocument[]       @relation("AffiliateDocument_uploadedByIdToUser")
  AffiliateInteraction                                          AffiliateInteraction[]
  AffiliateLink                                                 AffiliateLink[]
  AffiliateLinkEvent                                            AffiliateLinkEvent[]
  AffiliateMedia                                                AffiliateMedia[]
  AffiliatePayslip                                              AffiliatePayslip[]
  AffiliateProfile                                              AffiliateProfile?
  CertificateApproval_CertificateApproval_approvedByToUser      CertificateApproval[]     @relation("CertificateApproval_approvedByToUser")
  CertificateApproval_CertificateApproval_customerIdToUser      CertificateApproval[]     @relation("CertificateApproval_customerIdToUser")
  CertificateApproval_CertificateApproval_requesterIdToUser     CertificateApproval[]     @relation("CertificateApproval_requesterIdToUser")
  ChatBotSession                                                ChatBotSession[]
  ChatHistory                                                   ChatHistory[]
  CommissionAdjustment_CommissionAdjustment_approvedByIdToUser  CommissionAdjustment[]    @relation("CommissionAdjustment_approvedByIdToUser")
  CommissionAdjustment_CommissionAdjustment_requestedByIdToUser CommissionAdjustment[]    @relation("CommissionAdjustment_requestedByIdToUser")
  CommunityComment                                              CommunityComment[]
  CommunityPost                                                 CommunityPost[]
  CruiseReview                                                  CruiseReview[]
  CustomerGroup                                                 CustomerGroup[]
  CustomerGroupMember_CustomerGroupMember_addedByToUser         CustomerGroupMember[]     @relation("CustomerGroupMember_addedByToUser")
  CustomerGroupMember_CustomerGroupMember_userIdToUser          CustomerGroupMember[]     @relation("CustomerGroupMember_userIdToUser")
  CustomerJourney                                               CustomerJourney[]
  CustomerNote_CustomerNote_createdByToUser                     CustomerNote[]            @relation("CustomerNote_createdByToUser")
  CustomerNote_CustomerNote_customerIdToUser                    CustomerNote[]            @relation("CustomerNote_customerIdToUser")
  DocumentApproval_DocumentApproval_approvedByToUser            DocumentApproval[]        @relation("DocumentApproval_approvedByToUser")
  DocumentApproval_DocumentApproval_requesterIdToUser           DocumentApproval[]        @relation("DocumentApproval_requesterIdToUser")
  EmailAddressBook                                              EmailAddressBook[]
  FeatureUsage                                                  FeatureUsage[]
  FunnelMessage                                                 FunnelMessage[]
  LandingPage                                                   LandingPage[]
  LandingPageFunnel                                             LandingPageFunnel[]
  LandingPageRegistration                                       LandingPageRegistration[]
  LandingPageView                                               LandingPageView[]
  LoginLog                                                      LoginLog[]
  MapTravelRecord                                               MapTravelRecord[]
  MarketingAccount                                              MarketingAccount[]
  MarketingInsight                                              MarketingInsight[]
  MeetingParticipant                                            MeetingParticipant[]
  MeetingRoom                                                   MeetingRoom[]
  MonthlySettlement                                             MonthlySettlement[]
  PassportRequestLog_PassportRequestLog_adminIdToUser           PassportRequestLog[]      @relation("PassportRequestLog_adminIdToUser")
  PassportRequestLog_PassportRequestLog_userIdToUser            PassportRequestLog[]      @relation("PassportRequestLog_userIdToUser")
  PassportRequestTemplate                                       PassportRequestTemplate[]
  PassportSubmission                                            PassportSubmission[]
  PasswordEvent                                                 PasswordEvent[]
  ProductInquiry                                                ProductInquiry[]
  ProductView                                                   ProductView[]
  PushSubscription                                              PushSubscription[]
  RePurchaseTrigger                                             RePurchaseTrigger[]
  Reservation                                                   Reservation[]
  ScheduledMessage                                              ScheduledMessage[]
  ScheduledMessageLog                                           ScheduledMessageLog[]
  Session                                                       Session[]
  SettlementEvent                                               SettlementEvent[]
  TravelDiaryEntry                                              TravelDiaryEntry[]
  Traveler                                                      Traveler[]
  UserActivity                                                  UserActivity[]
  UserMessageRead                                               UserMessageRead[]
  UserSchedule                                                  UserSchedule[]
  UserTrip                                                      UserTrip[]
  VisitedCountry                                                VisitedCountry[]

  @@index([createdAt])
  @@index([customerSource])
  @@index([customerStatus, createdAt])
  @@index([customerStatus])
  @@index([isHibernated, lastActiveAt])
  @@index([lastActiveAt])
  @@index([mallUserId])
  @@index([phone])
  @@index([role, createdAt])
  @@index([role, customerSource])
  @@index([role, customerStatus])
  @@index([role, customerStatus, updatedAt])
  @@index([role])
  @@index([role, isHibernated, customerStatus])
  @@index([role, updatedAt])
  @@index([testModeStartedAt])
  @@index([customerStatus, customerSource, createdAt], map: "idx_user_customer_status_source_created")
}

model UserActivity {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String
  page      String
  metadata  Json?
  createdAt DateTime @default(now())
  User      User     @relation(fields: [userId], references: [id])

  @@index([action, createdAt])
  @@index([userId, createdAt])
}

model UserMessageRead {
  id           Int          @id @default(autoincrement())
  userId       Int
  messageId    Int
  readAt       DateTime     @default(now())
  AdminMessage AdminMessage @relation(fields: [messageId], references: [id])
  User         User         @relation(fields: [userId], references: [id])

  @@unique([userId, messageId])
  @@index([userId, readAt])
}

model UserSchedule {
  id        Int      @id @default(autoincrement())
  userId    Int
  date      DateTime
  time      String
  title     String
  alarm     Boolean  @default(false)
  alarmTime String?
  createdAt DateTime @default(now())
  updatedAt DateTime
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([date])
  @@index([userId, date])
}

model UserTrip {
  id                 Int                  @id @default(autoincrement())
  userId             Int
  productId          Int?
  reservationCode    String?
  cruiseName         String?
  companionType      String?
  destination        Json?
  startDate          DateTime?
  endDate            DateTime?
  nights             Int                  @default(0)
  days               Int                  @default(0)
  visitCount         Int                  @default(0)
  status             String               @default("Upcoming")
  createdAt          DateTime             @default(now())
  updatedAt          DateTime
  userTripFeedbackId Int?
  googleFolderId     String?
  spreadsheetId      String?
  ChatHistory        ChatHistory[]
  ChecklistItem      ChecklistItem[]
  Expense            Expense[]
  Itinerary          Itinerary[]
  PassportSubmission PassportSubmission[]
  TravelDiaryEntry   TravelDiaryEntry[]
  CruiseProduct      CruiseProduct?       @relation(fields: [productId], references: [id])
  User               User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  UserTripFeedback   UserTripFeedback?    @relation(fields: [userTripFeedbackId], references: [id])

  @@index([createdAt])
  @@index([startDate])
  @@index([status, startDate])
  @@index([userId, status])
}

model UserTripFeedback {
  id                  Int        @id @default(autoincrement())
  tripId              Int        @unique
  userId              Int
  satisfactionScore   Int?
  improvementComments String?
  detailedFeedback    Json?
  createdAt           DateTime   @default(now())
  updatedAt           DateTime
  UserTrip            UserTrip[]
  Trip                Trip       @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([userId])
}

model ViralLoop {
  id                                                                  Int                @id @default(autoincrement())
  accountId                                                           Int
  customerId                                                          Int
  referralCode                                                        String             @unique
  referredByCustomerId                                                Int?
  referralCount                                                       Int                @default(0)
  conversionCount                                                     Int                @default(0)
  rewardEarned                                                        Float              @default(0)
  status                                                              String             @default("ACTIVE")
  metadata                                                            Json?
  createdAt                                                           DateTime           @default(now())
  updatedAt                                                           DateTime
  MarketingAccount                                                    MarketingAccount   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  MarketingCustomer_ViralLoop_customerIdToMarketingCustomer           MarketingCustomer  @relation("ViralLoop_customerIdToMarketingCustomer", fields: [customerId], references: [id], onDelete: Cascade)
  MarketingCustomer_ViralLoop_referredByCustomerIdToMarketingCustomer MarketingCustomer? @relation("ViralLoop_referredByCustomerIdToMarketingCustomer", fields: [referredByCustomerId], references: [id])

  @@index([accountId, status])
  @@index([customerId])
  @@index([referralCode])
  @@index([referredByCustomerId])
}

model VisitedCountry {
  id          Int      @id @default(autoincrement())
  userId      Int
  countryCode String
  countryName String
  visitCount  Int      @default(1)
  lastVisited DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime
  User        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, countryCode])
  @@index([userId])
}
