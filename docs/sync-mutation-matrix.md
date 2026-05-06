# Sync Mutation 覆盖矩阵

## 用途

本文件列出本地 outbox 语义 mutation 与云对象方法的固定映射。现行事实源仍是 `src/localdb/mutation-registry.ts`；本文件用于评审、验收与测试覆盖检查。

维护规则：

- 新增本地写路径时，先在 `LOCAL_MUTATION_TYPES` 与 `LOCAL_MUTATION_REGISTRY` 增加语义 mutation
- 云对象写方法必须支持 `_sync.clientMutationId / deviceId / baseVersions / clientEntityIds / clientTimestamp`
- 云对象返回必须稳定包含 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- 新增 mutation 后同步更新本文件，并补对应云对象幂等或冲突测试

## 矩阵

### 犬只

- `dog.create` → `dog-service.createDog`
- `dog.update` → `dog-service.updateDog`
- `dog.updateName` → `dog-service.updateDogName`
- `dog.changeDisposition` → `dog-service.changeDisposition`
- `dog.upgradePuppyToBreeder` → `dog-service.upgradePuppyToBreeder`
- `dog.softDelete` → `dog-service.softDeleteDog`
- `dog.restore` → `dog-service.restoreDog`

### 繁育

- `breeding.addBreedingRecord` → `breeding-service.addBreedingRecord`
- `breeding.batchAddBreedingRecords` → `breeding-service.batchAddBreedingRecords`
- `breeding.addBirthRecord` → `breeding-service.addBirthRecord`
- `breeding.updateBreedingRecord` → `breeding-service.updateBreedingRecord`
- `breeding.deleteBreedingRecord` → `breeding-service.deleteBreedingRecord`
- `breeding.closeCycle` → `breeding-service.closeCycle`
- `breeding.addPuppyToLitter` → `breeding-service.addPuppyToLitter`
- `breeding.updateLitter` → `breeding-service.updateLitter`
- `breeding.updateBirthDate` → `breeding-service.updateBirthDate`
- `breeding.confirmWeaning` → `breeding-service.confirmWeaning`

### 健康 / 用药 / 体重

- `health.batchAddHealthRecords` → `health-service.batchAddHealthRecords`
- `health.batchStartMedication` → `health-service.batchStartMedication`
- `health.updateHealthRecord` → `health-service.updateHealthRecord`
- `health.deleteHealthRecord` → `health-service.deleteHealthRecord`
- `health.recordMedicationDose` → `health-service.recordMedicationDose`
- `health.batchCompleteMedicationDay` → `health-service.batchCompleteMedicationDay`
- `health.endMedication` → `health-service.endMedication`
- `health.recoverIllnesses` → `health-service.recoverIllnesses`
- `health.batchUpdateIllnessStatus` → `health-service.batchUpdateIllnessStatus`
- `health.endMedicationByDog` → `health-service.endMedicationByDog`
- `health.addWeightRecord` → `health-service.addWeightRecord`
- `health.addMedicationProtocol` → `health-service.addMedicationProtocol`
- `health.removeMedicationProtocol` → `health-service.removeMedicationProtocol`

### 任务

- `task.batchCreateManualTasks` → `task-service.batchCreateManualTasks`
- `task.complete` → `task-service.completeTask`
- `task.batchComplete` → `task-service.batchCompleteTask`
- `task.postpone` → `task-service.postponeTask`
- `task.batchPostpone` → `task-service.batchPostponeTask`

### 财务 / 销售 / 代理人

- `finance.addExpense` → `finance-service.addExpense`
- `finance.addIncome` → `finance-service.addIncome`
- `finance.updateExpense` → `finance-service.updateExpense`
- `finance.updateIncome` → `finance-service.updateIncome`
- `finance.deleteExpense` → `finance-service.deleteExpense`
- `finance.deleteIncome` → `finance-service.deleteIncome`
- `finance.createSaleRecord` → `finance-service.createSaleRecord`
- `finance.receiveSaleDeposit` → `finance-service.receiveSaleDeposit`
- `finance.completeSale` → `finance-service.completeSale`
- `finance.settleSale` → `finance-service.settleSale`
- `finance.cancelSale` → `finance-service.cancelSale`
- `finance.addAgent` → `finance-service.addAgent`
- `finance.updateAgent` → `finance-service.updateAgent`
- `finance.removeAgent` → `finance-service.removeAgent`
- `finance.addExpenseCategoryGroup` → `finance-service.addExpenseCategoryGroup`
- `finance.updateExpenseCategoryGroup` → `finance-service.updateExpenseCategoryGroup`
- `finance.removeExpenseCategoryGroup` → `finance-service.removeExpenseCategoryGroup`
- `finance.addExpenseCategory` → `finance-service.addExpenseCategory`
- `finance.updateExpenseCategory` → `finance-service.updateExpenseCategory`
- `finance.removeExpenseCategory` → `finance-service.removeExpenseCategory`

### 家庭 / 配置 / 回收站

- `family.updateSettings` → `family-service.updateSettings`
- `family.addCareRule` → `family-service.addCareRule`
- `family.removeCareRule` → `family-service.removeCareRule`
- `family.updateNickname` → `family-service.updateNickname`
- `recycle.restore` → `family-service.restoreItem`
- `recycle.permanentDelete` → `family-service.permanentDeleteItem`
