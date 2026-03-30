import os
import garth
import logging
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
from garth.exc import GarthHTTPError, GarthException

from garminconnect.workout import (
    RunningWorkout,
    WorkoutSegment,
    ExecutableStep,
    RepeatGroup,
    create_warmup_step,
    create_interval_step,
    create_cooldown_step,
    create_repeat_group,
    TargetType,
    StepType
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Target():
    workoutTargetTypeId: TargetType = TargetType.NO_TARGET
    workoutTargetTypeKey: str = "no.target"
    displayOrder: int = 1
    value: float = 0.0

# Condition Type IDs
class ConditionType:
    """Common Garmin end condition type IDs."""
    LAP_BUTTON = 1
    TIME = 2
    DISTANCE = 3
    HEART_RATE = 4
    CALORIES = 5
    CADENCE = 6
    POWER = 7
    ITERATIONS = 8

# No changes here, just removing the imports that were moved up

class GarminClientConnect:
    def __init__(self, email: str, password: str, token_path: str = ".garmin_session"):
        self.email = email
        self.password = password
        # Resolve to absolute path to ensure consistency across different working directories
        self.token_path = Path(token_path).resolve()
        self.client = Garmin(email, password)
        self.is_logged_in = False

    def login(self) -> bool:
        try:
            # 1. Try to load existing session from disk
            if self.token_path.exists():
                try:
                    logger.info(f"Attempting to resume Garmin session from {self.token_path}...")
                    # garminconnect 0.2.0+ handles token loading via login(path)
                    self.client.login(str(self.token_path))
                    self.is_logged_in = True
                    logger.info("Garmin session resumed successfully.")
                    return True
                except (GarminConnectTooManyRequestsError, GarthHTTPError) as e:
                    if "429" in str(e):
                        logger.error(f"Rate limited by Garmin (429). Please wait before retrying. Details: {e}")
                        return False
                    logger.warning(f"Session resumption failed: {e}. Attempting fresh login...")
                except Exception as e:
                    logger.warning(f"Session expired or invalid: {e}. Attempting fresh login...")

            # 2. If load fails or doesn't exist, perform fresh login
            logger.info(f"Performing fresh Garmin login for {self.email}...")
            # Note: garmin.login() returns (result1, result2) in some versions if return_on_mfa is used,
            # but here we use the standard call.
            self.client.login()
            
            # 3. Save session to disk for next time
            self.token_path.mkdir(exist_ok=True, parents=True)
            self.client.garth.dump(str(self.token_path))
            logger.info(f"New Garmin session saved to {self.token_path}.")
            
            self.is_logged_in = True
            return True
        except GarminConnectTooManyRequestsError as e:
            logger.error(f"Garmin rate limit hit during fresh login: {e}")
            return False
        except GarthHTTPError as e:
            if "429" in str(e):
                logger.error(f"Garmin rate limit hit (429): {e}")
            else:
                logger.error(f"Garmin HTTP Error: {e}")
            return False
        except Exception as e:
            logger.error(f"Garmin Login failed: {e}")
            return False

    def upload_workout(self, workout: RunningWorkout) -> dict:
        if not self.is_logged_in:
            raise ConnectionError("Login first.")
        return self.client.upload_running_workout(workout)

    def create_custom_step(
        self,
        order: int,
        value: float,
        is_distance: bool = False,
        step_type: int = StepType.INTERVAL,
        target: Target = Target()
    ) -> ExecutableStep:
        """
        Creates an atomic step. 
        value: seconds if is_distance=False, meters if is_distance=True.
        """
        # condition_id = ConditionType.DISTANCE if is_distance else ConditionType.TIME
        # condition_key = "distance" if is_distance else "time"
        
        condition_id = ConditionType.DISTANCE if is_distance else ConditionType.TIME
        condition_key = "distance" if is_distance else "time"

        # Mapping for display order based on step type
        display_map = {StepType.WARMUP: 1, StepType.COOLDOWN: 2, StepType.INTERVAL: 3, StepType.RECOVERY: 4}

        return ExecutableStep(
            stepOrder=order,
            stepType={
                "stepTypeId": step_type,
                "stepTypeKey": next(k for k, v in StepType.__dict__.items() if v == step_type).lower(),
                "displayOrder": display_map.get(step_type, 3),
            },
            endCondition={
                "conditionTypeId": condition_id,
                "conditionTypeKey": condition_key,
                "displayOrder": condition_id,
                "displayable": True,
            },
            endConditionValue=value,
            targetType={
                "workoutTargetTypeId": target.workoutTargetTypeId,
                "workoutTargetTypeKey": target.workoutTargetTypeKey,
                "displayOrder": target.displayOrder,
            },
            targetValue=target.value if target.value > 0 else None
        )

    def create_complex_interval(
        self,
        name: str,
        iterations: int,
        inner_steps: list[ExecutableStep],
        warmup_secs: float = 600.0,
        cooldown_secs: float = 600.0
    ) -> RunningWorkout:
        """
        Creates a workout with an atomic repeat group containing N steps.
        """
        # 1. Warmup
        steps = [create_warmup_step(warmup_secs, 1)]

        # 2. Repeat Group (Note the order: iterations, steps, order)
        repeat_group = create_repeat_group(iterations, inner_steps, 2)
        steps.append(repeat_group)

        # 3. Cooldown
        steps.append(create_cooldown_step(cooldown_secs, 3))

        return RunningWorkout(
            workoutName=name,
            estimatedDurationInSecs=int(warmup_secs + cooldown_secs + 1800), # Estimate
            workoutSegments=[
                WorkoutSegment(
                    segmentOrder=1,
                    sportType={"sportTypeId": 1, "sportTypeKey": "running"},
                    workoutSteps=steps
                )
            ]
        )
if __name__ == "__main__":
    # 1. Setup credentials
    EMAIL = "mroy0407@gmail.com"
    # Note: In a real app, use environment variables
    PASSWORD = os.getenv("GARMIN_PASSWORD", "3s*5dcD#JGx5gHn!VAJF")

    # 2. Initialize our wrapper
    garmin_wrapper = GarminClientConnect(EMAIL, PASSWORD)

    if garmin_wrapper.login():
        logger.info("Logged in successfully.")

        # Create a workout: 10m Warmup, 4x(800m fast / 200m slow), 10m Cooldown
        # Note: stepOrder inside a repeat group starts at 1
        my_steps = [
            garmin_wrapper.create_custom_step(1, 400.0, is_distance=True, step_type=StepType.INTERVAL),
            garmin_wrapper.create_custom_step(2, 200.0, is_distance=True, step_type=StepType.RECOVERY),
            garmin_wrapper.create_custom_step(3, 200.0, is_distance=True, step_type=StepType.INTERVAL, target=Target(workoutTargetTypeId=TargetType.POWER, workoutTargetTypeKey="power.zone", displayOrder=1, value=150)),
            garmin_wrapper.create_custom_step(4, 90.0, is_distance=False, step_type=StepType.RECOVERY) # Time-based recovery
        ]

        # Create the full workout
        workout = garmin_wrapper.create_complex_interval(
            name="Atomic Pyramid",
            iterations=4,
            inner_steps=my_steps,
            warmup_secs=600.0,
            cooldown_secs=600.0
        )

        # Example API usage
        try:
            activities = garmin_wrapper.client.get_activities_by_date(
                startdate=datetime(2026, 3, 16).strftime("%Y-%m-%d"),
                enddate=datetime(2026, 3, 18).strftime("%Y-%m-%d"),
                activitytype="swimming"
            )
            logger.info(f"Activities found: {activities}")
        except Exception as e:
            logger.error(f"Failed to fetch activities: {e}")
