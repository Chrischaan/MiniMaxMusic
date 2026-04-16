import uuid
from dataclasses import dataclass
from typing import Literal, Optional

TaskStatus = Literal["pending", "done", "failed"]


@dataclass
class Task:
    id: str
    status: TaskStatus = "pending"
    title: str = ""
    audio_bytes: Optional[bytes] = None
    error: Optional[str] = None


TASKS: dict[str, Task] = {}


def create_task(title: str = "") -> Task:
    task = Task(id=uuid.uuid4().hex, title=title)
    TASKS[task.id] = task
    return task


def get_task(task_id: str) -> Optional[Task]:
    return TASKS.get(task_id)


def set_done(task_id: str, audio_bytes: bytes) -> None:
    task = TASKS.get(task_id)
    if task is None:
        return
    task.status = "done"
    task.audio_bytes = audio_bytes


def set_failed(task_id: str, error: str) -> None:
    task = TASKS.get(task_id)
    if task is None:
        return
    task.status = "failed"
    task.error = error
