# -*- coding: utf-8 -*-
"""A small, validated snapshot of the buyer's current shopping mission."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional


STAGES = {"explore", "clarify", "search", "compare", "confirm", "service"}


@dataclass(frozen=True)
class ShoppingPlan:
    goal: str
    stage: str = "explore"
    destination: Optional[str] = None
    budget_major: Optional[float] = None
    currency: str = "CNY"
    preferences: list[str] = field(default_factory=list)
    tasks: list[str] = field(default_factory=list)
    missing_slots: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.goal.strip():
            raise ValueError("购物目标不能为空")
        if self.stage not in STAGES:
            raise ValueError(f"未知购物阶段：{self.stage}")
        if self.budget_major is not None and self.budget_major <= 0:
            raise ValueError("预算必须大于 0")
        if len(self.tasks) > 4:
            raise ValueError("首期购物计划最多包含 4 个任务")

    def to_dict(self) -> dict:
        return asdict(self)
