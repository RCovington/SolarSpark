class ResourceItem extends Item {

    renderGraphic() {
        scale(0.3, 0.3);

        fs('#fff');
        renderResourcesIcon();
    }

    pickUp(ship) {
        ship.civilization.resources = min(PLANET_MAX_RESOURCES, ship.civilization.resources + 1);
        G.eventHub.emit(EVENT_PICKUP_RESOURCE, this);

        // Scoring: 1 point per 50 materials collected
        try { if (window.Score) Score.onMaterialCollected(1); } catch (e) {}

        G.resourceAnimation();

        pickupSound();
    }

}
