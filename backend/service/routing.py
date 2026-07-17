import os

from service.brouter_service import BRouterService
from service.graphhopper_service import GraphHopperService
from service.ign_service import IGNService


def get_routing_service():
    """Return the active routing backend (ign | brouter | graphhopper)."""
    provider = os.getenv("ROUTING_PROVIDER", "brouter").strip().lower()

    if provider == "brouter":
        return BRouterService
    # if provider == "graphhopper":
    #     return GraphHopperService
    # return IGNService
