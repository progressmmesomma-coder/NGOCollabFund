import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_MAX_MEMBERS = 101;
const ERR_INVALID_CONTRIB_AMOUNT = 102;
const ERR_INVALID_CYCLE_DUR = 103;
const ERR_INVALID_PENALTY_RATE = 104;
const ERR_INVALID_VOTING_THRESHOLD = 105;
const ERR_GROUP_ALREADY_EXISTS = 106;
const ERR_GROUP_NOT_FOUND = 107;
const ERR_INVALID_GROUP_TYPE = 115;
const ERR_INVALID_INTEREST_RATE = 116;
const ERR_INVALID_GRACE_PERIOD = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_MIN_CONTRIB = 110;
const ERR_INVALID_MAX_LOAN = 111;
const ERR_MAX_GROUPS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;

interface Pool {
  name: string;
  maxMembers: number;
  contribAmount: number;
  cycleDuration: number;
  penaltyRate: number;
  votingThreshold: number;
  timestamp: number;
  creator: string;
  poolType: string;
  interestRate: number;
  gracePeriod: number;
  location: string;
  currency: string;
  status: boolean;
  minContrib: number;
  maxLoan: number;
}

interface PoolUpdate {
  updateName: string;
  updateMaxMembers: number;
  updateContribAmount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PoolFactoryMock {
  state: {
    nextPoolId: number;
    maxPools: number;
    creationFee: number;
    authorityContract: string | null;
    pools: Map<number, Pool>;
    poolUpdates: Map<number, PoolUpdate>;
    poolsByName: Map<string, number>;
  } = {
    nextPoolId: 0,
    maxPools: 1000,
    creationFee: 1000,
    authorityContract: null,
    pools: new Map(),
    poolUpdates: new Map(),
    poolsByName: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextPoolId: 0,
      maxPools: 1000,
      creationFee: 1000,
      authorityContract: null,
      pools: new Map(),
      poolUpdates: new Map(),
      poolsByName: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createPool(
    name: string,
    maxMembers: number,
    contribAmount: number,
    cycleDuration: number,
    penaltyRate: number,
    votingThreshold: number,
    poolType: string,
    interestRate: number,
    gracePeriod: number,
    location: string,
    currency: string,
    minContrib: number,
    maxLoan: number
  ): Result<number> {
    if (this.state.nextPoolId >= this.state.maxPools) return { ok: false, value: ERR_MAX_GROUPS_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (maxMembers <= 0 || maxMembers > 50) return { ok: false, value: ERR_INVALID_MAX_MEMBERS };
    if (contribAmount <= 0) return { ok: false, value: ERR_INVALID_CONTRIB_AMOUNT };
    if (cycleDuration <= 0) return { ok: false, value: ERR_INVALID_CYCLE_DUR };
    if (penaltyRate > 100) return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    if (votingThreshold <= 0 || votingThreshold > 100) return { ok: false, value: ERR_INVALID_VOTING_THRESHOLD };
    if (!["rural", "urban", "community"].includes(poolType)) return { ok: false, value: ERR_INVALID_GROUP_TYPE };
    if (interestRate > 20) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minContrib <= 0) return { ok: false, value: ERR_INVALID_MIN_CONTRIB };
    if (maxLoan <= 0) return { ok: false, value: ERR_INVALID_MAX_LOAN };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.poolsByName.has(name)) return { ok: false, value: ERR_GROUP_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPoolId;
    const pool: Pool = {
      name,
      maxMembers,
      contribAmount,
      cycleDuration,
      penaltyRate,
      votingThreshold,
      timestamp: this.blockHeight,
      creator: this.caller,
      poolType,
      interestRate,
      gracePeriod,
      location,
      currency,
      status: true,
      minContrib,
      maxLoan,
    };
    this.state.pools.set(id, pool);
    this.state.poolsByName.set(name, id);
    this.state.nextPoolId++;
    return { ok: true, value: id };
  }

  getPool(id: number): Pool | null {
    return this.state.pools.get(id) || null;
  }

  updatePool(id: number, updateName: string, updateMaxMembers: number, updateContribAmount: number): Result<boolean> {
    const pool = this.state.pools.get(id);
    if (!pool) return { ok: false, value: false };
    if (pool.creator !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (updateMaxMembers <= 0 || updateMaxMembers > 50) return { ok: false, value: false };
    if (updateContribAmount <= 0) return { ok: false, value: false };
    if (this.state.poolsByName.has(updateName) && this.state.poolsByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Pool = {
      ...pool,
      name: updateName,
      maxMembers: updateMaxMembers,
      contribAmount: updateContribAmount,
      timestamp: this.blockHeight,
    };
    this.state.pools.set(id, updated);
    this.state.poolsByName.delete(pool.name);
    this.state.poolsByName.set(updateName, id);
    this.state.poolUpdates.set(id, {
      updateName,
      updateMaxMembers,
      updateContribAmount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getPoolCount(): Result<number> {
    return { ok: true, value: this.state.nextPoolId };
  }

  checkPoolExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.poolsByName.has(name) };
  }
}

describe("PoolFactory", () => {
  let contract: PoolFactoryMock;

  beforeEach(() => {
    contract = new PoolFactoryMock();
    contract.reset();
  });

  it("creates a pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "Alpha",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const pool = contract.getPool(0);
    expect(pool?.name).toBe("Alpha");
    expect(pool?.maxMembers).toBe(10);
    expect(pool?.contribAmount).toBe(100);
    expect(pool?.cycleDuration).toBe(30);
    expect(pool?.penaltyRate).toBe(5);
    expect(pool?.votingThreshold).toBe(50);
    expect(pool?.poolType).toBe("rural");
    expect(pool?.interestRate).toBe(10);
    expect(pool?.gracePeriod).toBe(7);
    expect(pool?.location).toBe("VillageX");
    expect(pool?.currency).toBe("STX");
    expect(pool?.minContrib).toBe(50);
    expect(pool?.maxLoan).toBe(1000);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate pool names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "Alpha",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.createPool(
      "Alpha",
      20,
      200,
      60,
      10,
      60,
      "urban",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_GROUP_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.createPool(
      "Beta",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("parses pool name with Clarity", () => {
    const cv = stringUtf8CV("Gamma");
    expect(cv.value).toBe("Gamma");
  });

  it("rejects pool creation without authority contract", () => {
    const result = contract.createPool(
      "NoAuth",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid max members", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "InvalidMembers",
      51,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_MEMBERS);
  });

  it("rejects invalid contribution amount", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "InvalidContrib",
      10,
      0,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CONTRIB_AMOUNT);
  });

  it("rejects invalid pool type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "InvalidType",
      10,
      100,
      30,
      5,
      50,
      "invalid",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GROUP_TYPE);
  });

  it("updates a pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "OldPool",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.updatePool(0, "NewPool", 15, 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pool = contract.getPool(0);
    expect(pool?.name).toBe("NewPool");
    expect(pool?.maxMembers).toBe(15);
    expect(pool?.contribAmount).toBe(200);
    const update = contract.state.poolUpdates.get(0);
    expect(update?.updateName).toBe("NewPool");
    expect(update?.updateMaxMembers).toBe(15);
    expect(update?.updateContribAmount).toBe(200);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent pool", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePool(99, "NewPool", 15, 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "TestPool",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    contract.caller = "ST3FAKE";
    const result = contract.updatePool(0, "NewPool", 15, 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(2000);
    contract.createPool(
      "TestPool",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority contract", () => {
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct pool count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "Pool1",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    contract.createPool(
      "Pool2",
      15,
      200,
      60,
      10,
      60,
      "urban",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    const result = contract.getPoolCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks pool existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "TestPool",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.checkPoolExistence("TestPool");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkPoolExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses pool parameters with Clarity types", () => {
    const name = stringUtf8CV("TestPool");
    const maxMembers = uintCV(10);
    const contribAmount = uintCV(100);
    expect(name.value).toBe("TestPool");
    expect(maxMembers.value).toEqual(BigInt(10));
    expect(contribAmount.value).toEqual(BigInt(100));
  });

  it("rejects pool creation with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects pool creation with max pools exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPools = 1;
    contract.createPool(
      "Pool1",
      10,
      100,
      30,
      5,
      50,
      "rural",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.createPool(
      "Pool2",
      15,
      200,
      60,
      10,
      60,
      "urban",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_GROUPS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});
