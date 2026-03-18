from garminconnect import Garmin
from garminconnect.workout import (
    RunningWorkout,
    WorkoutSegment,
    ExecutableStep,
    RepeatGroup,
    create_warmup_step,
    create_interval_step,
    create_cooldown_step,
    create_repeat_group,
    ConditionType,
    TargetType,
    StepType
)

class GarminClientConnect:
    def __init__(self, email: str, password: str):
        self.client = Garmin(email, password)
        self.is_logged_in = False

    def login(self) -> bool:
        try:
            self.client.login()
            self.is_logged_in = True
            return True
        except Exception as e:
            print(f"Login failed: {e}")
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
        target: dict | None = None
    ) -> ExecutableStep:
        """
        Creates an atomic step. 
        value: seconds if is_distance=False, meters if is_distance=True.
        """
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
            targetType=target or {
                "workoutTargetTypeId": TargetType.NO_TARGET,
                "workoutTargetTypeKey": "no.target",
                "displayOrder": 1,
            }
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
    PASSWORD = "3s*5dcD#JGx5gHn!VAJF"

    # 2. Initialize our wrapper
    garmin_wrapper = GarminClientConnect(EMAIL, PASSWORD)

    if garmin_wrapper.login():
        print("Logged in successfully.")

        client = GarminClientConnect(EMAIL, PASSWORD)

    if client.login():
        # Create a workout: 10m Warmup, 4x(800m fast / 200m slow), 10m Cooldown
        # Note: stepOrder inside a repeat group starts at 1
        my_steps = [
            client.create_custom_step(1, 400.0, is_distance=True, step_type=StepType.INTERVAL),
            client.create_custom_step(2, 200.0, is_distance=True, step_type=StepType.RECOVERY),
            client.create_custom_step(3, 200.0, is_distance=True, step_type=StepType.INTERVAL),
            client.create_custom_step(4, 90.0, is_distance=False, step_type=StepType.RECOVERY) # Time-based recovery
        ]

        # Create the full workout
        workout = client.create_complex_interval(
            name="Atomic Pyramid",
            iterations=4,
            inner_steps=my_steps
        )

        # Upload
        res = client.upload_workout(workout)
        print(f"Workout ID: {res['workoutId']}")