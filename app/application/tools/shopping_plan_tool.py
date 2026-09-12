# -*- coding: utf-8 -*-
"""MainAgent tool for publishing one structured shopping mission."""
import json
from typing import Optional

from agentscope.message import TextBlock, ToolResultState
from agentscope.tool import ToolChunk

from app.domain.session.shopping_plan import ShoppingPlan
from app.infrastructure.context import ShoppingContext
from app.infrastructure.eventbus import TradeEventBus


def build_update_shopping_plan_tool(bus: TradeEventBus):
    async def update_shopping_plan_tool(
        goal: str,
        stage: str = "explore",
        destination: Optional[str] = None,
        budget_major: float | str | None = None,
        currency: str = "CNY",
        preferences: list[str] | None = None,
        tasks: list[str] | None = None,
        missing_slots: list[str] | None = None,
    ) -> ToolChunk:
        """Create or update the structured plan for a scene-based shopping request.

        Args:
            goal (`str`): The buyer's overall mission, such as "prepare for a US camping trip".
            stage (`str`): One of explore, clarify, search, compare, confirm, service.
            destination (`str | None`): Two-letter destination code, such as US or JP.
            budget_major (`float | None`): Total budget in major currency units.
            currency (`str`): Budget currency, default CNY.
            preferences (`list[str] | None`): Explicit preferences such as lightweight or durable.
            tasks (`list[str] | None`): Up to four concrete product tasks, such as camping light.
            missing_slots (`list[str] | None`): Important unknowns that may require one question.
        """
        if isinstance(budget_major, str):
            try:
                budget_major = float(budget_major)
            except ValueError:
                return ToolChunk(
                    content=[TextBlock(type="text", text=f"[error] budget_major 非法：{budget_major}")],
                    state=ToolResultState.ERROR,
                )
        try:
            plan = ShoppingPlan(
                goal=goal,
                stage=stage,
                destination=destination.upper() if destination else None,
                budget_major=budget_major,
                currency=currency.upper(),
                preferences=preferences or [],
                tasks=tasks or [],
                missing_slots=missing_slots or [],
            )
        except ValueError as err:
            return ToolChunk(
                content=[TextBlock(type="text", text=f"[error] {err}")],
                state=ToolResultState.ERROR,
            )

        payload = plan.to_dict()
        bus.publish(
            ShoppingContext.current_session_id(),
            "plan.update",
            {"shopping_plan": payload},
        )
        return ToolChunk(
            content=[TextBlock(type="text", text=json.dumps(payload, ensure_ascii=False))],
            state=ToolResultState.SUCCESS,
        )

    return update_shopping_plan_tool
