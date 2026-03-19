import type { TaskOverrideActionFunction } from 'hardhat/types/tasks';

const SKIP_ENV_VAR = 'COFHE_SKIP_MOCKS_DEPLOY';

const action: TaskOverrideActionFunction = async (taskArguments, hre, runSuper) => {
  const raw = process.env[SKIP_ENV_VAR] ?? '';
  const skipAutoDeploy = ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());

  if (!skipAutoDeploy) {
    await hre.cofhe.mocks.deployMocks({
      deployTestBed: true,
      gasWarning: hre.config.cofhe.gasWarning,
    });
  }

  return runSuper(taskArguments);
};

export default action;
